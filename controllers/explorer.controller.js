const User = require('../models/user.model.js');
const explorerServices = require('../services/explorer-services.js');
const Explorer = require('../models/explorer.model.js');
const { uploadToS3 } = require('../services/s3Config-services');
const path = require('path');

class ExplorerController {
    // Get all releases
    static async getAllReleases(req, res) {
        try {
            const releases = await explorerServices.getAllReleases();

            res.status(200).json({
                status: 200,
                message: 'Releases retrieved successfully',
                data: releases
            });
        } catch (error) {
            console.error('Error getting releases:', error);
            res.status(500).json({
                status: 500,
                message: 'Failed to retrieve releases',
                error: error.message
            });
        }
    }

    // Get latest release (for frontend display)
    static async getLatestRelease(req, res) {
        try {
            const release = await explorerServices.getLatestRelease();

            res.status(200).json({
                status: 200,
                message: 'Latest release retrieved successfully',
                data: release
            });
        } catch (error) {
            console.error('Error getting latest release:', error);
            res.status(500).json({
                status: 500,
                message: 'Failed to retrieve latest release',
                error: error.message
            });
        }
    }

    static async getLatestReleaseForUser(req, res) {
        try {

            const userId = req.user.id;
            const release = await explorerServices.getLatestRelease();

            console.log("release", release);
            

            if (!release) {
                return res.status(404).json({ 
                    status: 404,
                    message: 'No releases available',
                    data: null
                });
            }

            const user = await User.findById(userId).select('exploredFeatures lastExploredVersion');

            if (!user) {
                return res.status(404).json({
                    status: 404,
                    message: 'User not found',
                    data: null
                });
            }

            const exploredFeatures = user.exploredFeatures || [];
            const lastExploredVersion = user.lastExploredVersion || null;
            const hasExploredThisVersion = lastExploredVersion === release.releaseVersion;

            const featuresWithExploredStatus = release.features.map(feature => ({
                ...feature.toObject(),
                isExplored: exploredFeatures.some(
                    ef => ef.releaseId.toString() === release._id.toString() &&
                        ef.featureId.toString() === feature._id.toString()
                )
            }));

            res.status(200).json({
                status: 200,
                message: 'Latest release retrieved successfully',
                data: {
                    ...release.toObject(),
                    features: featuresWithExploredStatus,
                    hasExploredThisVersion
                }
            });
        } catch (error) {
            console.error('Error getting latest release:', error);
            res.status(500).json({
                status: 500,
                message: 'Failed to retrieve latest release',
                error: error.message
            });
        }
    }

    static async markFeatureAsExplored(req, res) {
        try {
            const userId = req.user.id;
            const { releaseId, featureId } = req.body;

            const user = await User.findById(userId);

            const alreadyExplored = user.exploredFeatures.some(
                ef => ef.releaseId.toString() === releaseId &&
                    ef.featureId.toString() === featureId
            );

            if (!alreadyExplored) {
                user.exploredFeatures.push({
                    releaseId,
                    featureId,
                    exploredAt: new Date()
                });
            }

            const release = await Explorer.findById(releaseId);
            const allFeaturesExplored = release.features.every(feature =>
                user.exploredFeatures.some(
                    ef => ef.releaseId.toString() === releaseId &&
                        ef.featureId.toString() === feature._id.toString()
                )
            );

            if (allFeaturesExplored) {
                user.lastExploredVersion = release.releaseVersion;
            }

            await user.save();

            res.status(200).json({
                status: 200,
                message: 'Feature marked as explored',
                data: {
                    allFeaturesExplored
                }
            });
        } catch (error) {
            console.error('Error marking feature as explored:', error);
            res.status(500).json({
                status: 500,
                message: 'Failed to mark feature as explored',
                error: error.message
            });
        }
    }

    // Create new release with multiple features
    static async createRelease(req, res) {
        try {
            const { releaseVersion, releaseDate, features } = req.body;

            if (!releaseVersion) {
                return res.status(400).json({
                    status: 400,
                    message: 'Release version is required'
                });
            }

            if (!features || !Array.isArray(features) || features.length === 0) {
                return res.status(400).json({
                    status: 400,
                    message: 'At least one feature is required'
                });
            }

            // Process features
            const processedFeatures = [];

            for (let i = 0; i < features.length; i++) {
                const feature = features[i];

                if (!feature.videoFile || !feature.videoFile.fileBuffer) {
                    return res.status(400).json({
                        status: 400,
                        message: `Video file is required for feature ${i + 1}`
                    });
                }

                // Generate unique filename
                const ext = path.extname(feature.videoFile.fileName);
                const timestamp = Date.now();
                const uniqueId = Math.random().toString(36).substr(2, 9);
                const finalFilename = `feature-${timestamp}-${uniqueId}${ext}`;
                const s3Key = `explorer/features/${finalFilename}`;

                processedFeatures.push({
                    headline: feature.headline,
                    description: feature.description,
                    highlights: Array.isArray(feature.highlights) ? feature.highlights : JSON.parse(feature.highlights),
                    videoUrl: s3Key,
                    videoFileName: finalFilename,
                    videoMimeType: feature.videoFile.mimeType,
                    uploadStatus: 'uploading',
                    order: i + 1
                });

                // Store video buffer for later upload
                feature._videoBuffer = Buffer.from(feature.videoFile.fileBuffer, 'base64');
                feature._s3Key = s3Key;
            }

            // Create release
            const releaseData = {
                releaseVersion,
                releaseDate: releaseDate || new Date(),
                features: processedFeatures
            };

            const result = await explorerServices.createRelease(releaseData);

            // Send response first
            res.status(202).json({
                status: 202,
                message: 'Release created successfully. Videos are being uploaded.',
                data: result
            });

            // Upload videos in background
            for (let i = 0; i < features.length; i++) {
                const feature = features[i];
                const featureId = result.features[i]._id;

                try {
                    await uploadToS3(feature._videoBuffer, feature._s3Key, feature.videoFile.mimeType);
                    console.log(`Successfully uploaded video: ${feature._s3Key}`);

                    await explorerServices.updateFeatureStatus(result._id, featureId, 'active');
                } catch (error) {
                    console.error(`Failed to upload video ${feature._s3Key}:`, error);
                    await explorerServices.updateFeatureStatus(result._id, featureId, 'failed');
                }
            }

        } catch (error) {
            console.error('Error creating release:', error);
            res.status(500).json({
                status: 500,
                message: 'Failed to create release',
                error: error.message
            });
        }
    }

    // Add feature to existing release
    static async addFeature(req, res) {
        try {
            const { releaseId } = req.params;
            const { headline, description, highlights, videoFile } = req.body;

            if (!videoFile || !videoFile.fileBuffer) {
                return res.status(400).json({
                    status: 400,
                    message: 'Video file is required'
                });
            }

            // Generate unique filename
            const ext = path.extname(videoFile.fileName);
            const timestamp = Date.now();
            const uniqueId = Math.random().toString(36).substr(2, 9);
            const finalFilename = `feature-${timestamp}-${uniqueId}${ext}`;
            const s3Key = `explorer/features/${finalFilename}`;

            const featureData = {
                headline,
                description,
                highlights: Array.isArray(highlights) ? highlights : JSON.parse(highlights),
                videoUrl: s3Key,
                videoFileName: finalFilename,
                videoMimeType: videoFile.mimeType
            };

            const result = await explorerServices.addFeatureToRelease(releaseId, featureData);

            // Send response
            res.status(202).json({
                status: 202,
                message: 'Feature added successfully. Video is being uploaded.',
                data: result
            });

            // Upload video in background
            const addedFeature = result.features[result.features.length - 1];
            try {
                const buffer = Buffer.from(videoFile.fileBuffer, 'base64');
                await uploadToS3(buffer, s3Key, videoFile.mimeType);
                console.log(`Successfully uploaded video: ${finalFilename}`);

                await explorerServices.updateFeatureStatus(releaseId, addedFeature._id, 'active');
            } catch (error) {
                console.error(`Failed to upload video ${finalFilename}:`, error);
                await explorerServices.updateFeatureStatus(releaseId, addedFeature._id, 'failed');
            }

        } catch (error) {
            console.error('Error adding feature:', error);
            res.status(500).json({
                status: 500,
                message: 'Failed to add feature',
                error: error.message
            });
        }
    }

    // Update feature
    static async updateFeature(req, res) {
        try {
            const { releaseId, featureId } = req.params;
            const { headline, description, highlights, videoFile } = req.body;

            const updateData = {
                headline,
                description,
                highlights: highlights ? (Array.isArray(highlights) ? highlights : JSON.parse(highlights)) : undefined
            };

            // Remove undefined values
            Object.keys(updateData).forEach(key =>
                updateData[key] === undefined && delete updateData[key]
            );

            // If new video file is provided
            if (videoFile && videoFile.fileBuffer) {
                const ext = path.extname(videoFile.fileName);
                const timestamp = Date.now();
                const uniqueId = Math.random().toString(36).substr(2, 9);
                const finalFilename = `feature-${timestamp}-${uniqueId}${ext}`;
                const s3Key = `explorer/features/${finalFilename}`;

                updateData.videoUrl = s3Key;
                updateData.videoFileName = finalFilename;
                updateData.videoMimeType = videoFile.mimeType;
                updateData.uploadStatus = 'uploading';

                const result = await explorerServices.updateFeature(releaseId, featureId, updateData);

                res.status(202).json({
                    status: 202,
                    message: 'Feature updated successfully. New video is being uploaded.',
                    data: result
                });

                // Upload new video in background
                try {
                    const buffer = Buffer.from(videoFile.fileBuffer, 'base64');
                    await uploadToS3(buffer, s3Key, videoFile.mimeType);
                    console.log(`Successfully uploaded new video: ${finalFilename}`);
                    await explorerServices.updateFeatureStatus(releaseId, featureId, 'active');
                } catch (error) {
                    console.error(`Failed to upload video ${finalFilename}:`, error);
                    await explorerServices.updateFeatureStatus(releaseId, featureId, 'failed');
                }
            } else {
                const result = await explorerServices.updateFeature(releaseId, featureId, updateData);
                res.status(200).json({
                    status: 200,
                    message: 'Feature updated successfully',
                    data: result
                });
            }

        } catch (error) {
            console.error('Error updating feature:', error);
            res.status(500).json({
                status: 500,
                message: 'Failed to update feature',
                error: error.message
            });
        }
    }

    // Delete feature
    static async deleteFeature(req, res) {
        try {
            const { releaseId, featureId } = req.params;

            await explorerServices.deleteFeature(releaseId, featureId);

            res.status(200).json({
                status: 200,
                message: 'Feature deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting feature:', error);
            res.status(500).json({
                status: 500,
                message: 'Failed to delete feature',
                error: error.message
            });
        }
    }

    // Delete entire release
    static async deleteRelease(req, res) {
        try {
            const { id } = req.params;

            await explorerServices.deleteRelease(id);

            res.status(200).json({
                status: 200,
                message: 'Release deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting release:', error);
            res.status(500).json({
                status: 500,
                message: 'Failed to delete release',
                error: error.message
            });
        }
    }

    // Reorder features
    static async reorderFeatures(req, res) {
        try {
            const { releaseId } = req.params;
            const { featureIds } = req.body;

            if (!Array.isArray(featureIds)) {
                return res.status(400).json({
                    status: 400,
                    message: 'featureIds must be an array'
                });
            }

            const result = await explorerServices.reorderFeatures(releaseId, featureIds);

            res.status(200).json({
                status: 200,
                message: 'Features reordered successfully',
                data: result
            });
        } catch (error) {
            console.error('Error reordering features:', error);
            res.status(500).json({
                status: 500,
                message: 'Failed to reorder features',
                error: error.message
            });
        }
    }
}

module.exports = ExplorerController;