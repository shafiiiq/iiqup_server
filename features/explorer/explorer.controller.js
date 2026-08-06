const logger = require('../../shared/logger/logger');

const HTTP = require('../../shared/constants/httpStatus.constant.js');
const { sendSuccess, sendError } = require('../../shared/response/response.util');
// controllers/explorer.controller.js
const path = require('path');
const User = require('../user/user.model');
const explorerServices = require('./explorer.service');
const Explorer = require('./explorer.model');
const { uploadToS3 } = require('../../shared/services/s3.service.js');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const generateS3Key = (fileName) => {
  const ext = path.extname(fileName);
  const uniqueId = Math.random().toString(36).substr(2, 9);
  const filename = `feature-${Date.now()}-${uniqueId}${ext}`;
  return { finalFilename: filename, s3Key: `explorer/features/${filename}` };
};

const parseHighlights = (highlights) =>
  Array.isArray(highlights) ? highlights : JSON.parse(highlights);

// ─────────────────────────────────────────────────────────────────────────────
// Release Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /explorer/releases
 * Returns all releases.
 */
const getAllReleases = async (req, res) => {
  try {
    const result = await explorerServices.getAllReleases(req.pagination);

    sendSuccess(res, {
      success: true,
      message: 'Releases retrieved successfully',
      data: result.data,
      pagination: result.pagination,
      count: result.data.length,
    });
  } catch (error) {
    logger.error('[Explorer] getAllReleases:', error);
    sendError(res, {
      success: false,
      message: 'Failed to retrieve releases',
      error: error.message,
    });
  }
};

/**
 * GET /explorer/releases/latest
 * Returns the most recent release.
 */
const getLatestRelease = async (req, res) => {
  try {
    const release = await explorerServices.getLatestRelease();

    sendSuccess(res, {
      success: true,
      message: 'Latest release retrieved successfully',
      data: release,
    });
  } catch (error) {
    logger.error('[Explorer] getLatestRelease:', error);
    sendError(res, {
      success: false,
      message: 'Failed to retrieve latest release',
      error: error.message,
    });
  }
};

/**
 * GET /explorer/releases/latest/me
 * Returns the latest release enriched with the authenticated user's explored-feature status.
 */
const getLatestReleaseForUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const release = await explorerServices.getLatestRelease();

    if (!release) {
      return res
        .status(HTTP.NOT_FOUND)
        .json({ success: false, message: 'No releases available', data: null });
    }

    const user = await User.findById(userId).select(
      'exploredFeatures lastExploredVersion'
    );

    if (!user) {
      return res
        .status(HTTP.NOT_FOUND)
        .json({ success: false, message: 'User not found', data: null });
    }

    const exploredFeatures = user.exploredFeatures || [];
    const lastExploredVersion = user.lastExploredVersion || null;
    const hasExploredThisVersion =
      lastExploredVersion === release.releaseVersion;

    const featuresWithExploredStatus = release.features.map((feature) => ({
      ...feature.toObject(),
      isExplored: exploredFeatures.some(
        (ef) =>
          ef.releaseId.toString() === release._id.toString() &&
          ef.featureId.toString() === feature._id.toString()
      ),
    }));

    sendSuccess(res, {
      success: true,
      message: 'Latest release retrieved successfully',
      data: {
        ...release.toObject(),
        features: featuresWithExploredStatus,
        hasExploredThisVersion,
      },
    });
  } catch (error) {
    logger.error('[Explorer] getLatestReleaseForUser:', error);
    sendError(res, {
      success: false,
      message: 'Failed to retrieve latest release',
      error: error.message,
    });
  }
};

/**
 * POST /explorer/releases
 * Creates a new release with one or more features; videos are uploaded to S3 asynchronously.
 */
const createRelease = async (req, res) => {
  try {
    const { releaseVersion, releaseDate, features } = req.body;

    if (!releaseVersion) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'Release version is required' });
    }

    if (!features || !Array.isArray(features) || features.length === 0) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'At least one feature is required' });
    }

    const processedFeatures = [];

    for (let i = 0; i < features.length; i++) {
      const feature = features[i];

      if (!feature.videoFile?.fileBuffer) {
        return sendError(res, {
          success: false,
          message: `Video file is required for feature ${i + 1}`,
        });
      }

      const { finalFilename, s3Key } = generateS3Key(
        feature.videoFile.fileName
      );

      processedFeatures.push({
        headline: feature.headline,
        description: feature.description,
        highlights: parseHighlights(feature.highlights),
        videoUrl: s3Key,
        videoFileName: finalFilename,
        videoMimeType: feature.videoFile.mimeType,
        uploadStatus: 'uploading',
        order: i + 1,
      });

      feature._videoBuffer = Buffer.from(
        feature.videoFile.fileBuffer,
        'base64'
      );
      feature._s3Key = s3Key;
    }

    const result = await explorerServices.createRelease({
      releaseVersion,
      releaseDate: releaseDate || new Date(),
      features: processedFeatures,
    });

    sendSuccess(res, {
      success: true,
      message: 'Release created successfully. Videos are being uploaded.',
      data: result,
    });

    for (let i = 0; i < features.length; i++) {
      const feature = features[i];
      const featureId = result.features[i]._id;
      try {
        await uploadToS3(
          feature._videoBuffer,
          feature._s3Key,
          feature.videoFile.mimeType
        );
        await explorerServices.updateFeatureStatus(
          result._id,
          featureId,
          'active'
        );
      } catch (error) {
        logger.error(
          `[Explorer] createRelease — upload failed for ${feature._s3Key}:`,
          error
        );
        await explorerServices.updateFeatureStatus(
          result._id,
          featureId,
          'failed'
        );
      }
    }
  } catch (error) {
    logger.error('[Explorer] createRelease:', error);
    sendError(res, {
      success: false,
      message: 'Failed to create release',
      error: error.message,
    });
  }
};

/**
 * DELETE /explorer/releases/:id
 * Deletes an entire release by ID.
 */
const deleteRelease = async (req, res) => {
  try {
    const { id } = req.params;

    await explorerServices.deleteRelease(id);

    sendSuccess(res, {
      success: true,
      message: 'Release deleted successfully',
    });
  } catch (error) {
    logger.error('[Explorer] deleteRelease:', error);
    sendError(res, {
      success: false,
      message: 'Failed to delete release',
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Feature Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /explorer/releases/:releaseId/features
 * Adds a new feature to an existing release; video is uploaded to S3 asynchronously.
 */
const addFeature = async (req, res) => {
  try {
    const { releaseId } = req.params;
    const { headline, description, highlights, videoFile } = req.body;

    if (!videoFile?.fileBuffer) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'Video file is required' });
    }

    const { finalFilename, s3Key } = generateS3Key(videoFile.fileName);

    const featureData = {
      headline,
      description,
      highlights: parseHighlights(highlights),
      videoUrl: s3Key,
      videoFileName: finalFilename,
      videoMimeType: videoFile.mimeType,
    };

    const result = await explorerServices.addFeatureToRelease(
      releaseId,
      featureData
    );
    const addedFeature = result.features[result.features.length - 1];

    sendSuccess(res, {
      success: true,
      message: 'Feature added successfully. Video is being uploaded.',
      data: result,
    });

    try {
      const buffer = Buffer.from(videoFile.fileBuffer, 'base64');
      await uploadToS3(buffer, s3Key, videoFile.mimeType);
      await explorerServices.updateFeatureStatus(
        releaseId,
        addedFeature._id,
        'active'
      );
    } catch (error) {
      logger.error(
        `[Explorer] addFeature — upload failed for ${finalFilename}:`,
        error
      );
      await explorerServices.updateFeatureStatus(
        releaseId,
        addedFeature._id,
        'failed'
      );
    }
  } catch (error) {
    logger.error('[Explorer] addFeature:', error);
    sendError(res, {
      success: false,
      message: 'Failed to add feature',
      error: error.message,
    });
  }
};

/**
 * PUT /explorer/releases/:releaseId/features/:featureId
 * Updates a feature's metadata and optionally replaces its video.
 */
const updateFeature = async (req, res) => {
  try {
    const { releaseId, featureId } = req.params;
    const { headline, description, highlights, videoFile } = req.body;

    const updateData = {
      ...(headline !== undefined && { headline }),
      ...(description !== undefined && { description }),
      ...(highlights !== undefined && {
        highlights: parseHighlights(highlights),
      }),
    };

    if (videoFile?.fileBuffer) {
      const { finalFilename, s3Key } = generateS3Key(videoFile.fileName);

      Object.assign(updateData, {
        videoUrl: s3Key,
        videoFileName: finalFilename,
        videoMimeType: videoFile.mimeType,
        uploadStatus: 'uploading',
      });

      const result = await explorerServices.updateFeature(
        releaseId,
        featureId,
        updateData
      );

      sendSuccess(res, {
        success: true,
        message: 'Feature updated successfully. New video is being uploaded.',
        data: result,
      });

      try {
        const buffer = Buffer.from(videoFile.fileBuffer, 'base64');
        await uploadToS3(buffer, s3Key, videoFile.mimeType);
        await explorerServices.updateFeatureStatus(
          releaseId,
          featureId,
          'active'
        );
      } catch (error) {
        logger.error(
          `[Explorer] updateFeature — upload failed for ${finalFilename}:`,
          error
        );
        await explorerServices.updateFeatureStatus(
          releaseId,
          featureId,
          'failed'
        );
      }
    } else {
      const result = await explorerServices.updateFeature(
        releaseId,
        featureId,
        updateData
      );

      sendSuccess(res, {
        success: true,
        message: 'Feature updated successfully',
        data: result,
      });
    }
  } catch (error) {
    logger.error('[Explorer] updateFeature:', error);
    sendError(res, {
      success: false,
      message: 'Failed to update feature',
      error: error.message,
    });
  }
};

/**
 * DELETE /explorer/releases/:releaseId/features/:featureId
 * Removes a single feature from a release.
 */
const deleteFeature = async (req, res) => {
  try {
    const { releaseId, featureId } = req.params;

    await explorerServices.deleteFeature(releaseId, featureId);

    sendSuccess(res, {
      success: true,
      message: 'Feature deleted successfully',
    });
  } catch (error) {
    logger.error('[Explorer] deleteFeature:', error);
    sendError(res, {
      success: false,
      message: 'Failed to delete feature',
      error: error.message,
    });
  }
};

/**
 * PUT /explorer/releases/:releaseId/features/reorder
 * Updates the display order of features within a release.
 */
const reorderFeatures = async (req, res) => {
  try {
    const { releaseId } = req.params;
    const { featureIds } = req.body;

    if (!Array.isArray(featureIds)) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'featureIds must be an array' });
    }

    const result = await explorerServices.reorderFeatures(
      releaseId,
      featureIds
    );

    sendSuccess(res, {
      success: true,
      message: 'Features reordered successfully',
      data: result,
    });
  } catch (error) {
    logger.error('[Explorer] reorderFeatures:', error);
    sendError(res, {
      success: false,
      message: 'Failed to reorder features',
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// User Exploration Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /explorer/features/mark-explored
 * Marks a specific feature as explored for the authenticated user.
 */
const markFeatureAsExplored = async (req, res) => {
  try {
    const userId = req.user.id;
    const { releaseId, featureId } = req.body;

    const user = await User.findById(userId);

    const alreadyExplored = user.exploredFeatures.some(
      (ef) =>
        ef.releaseId.toString() === releaseId &&
        ef.featureId.toString() === featureId
    );

    if (!alreadyExplored) {
      user.exploredFeatures.push({
        releaseId,
        featureId,
        exploredAt: new Date(),
      });
    }

    const release = await Explorer.findById(releaseId);
    const allFeaturesExplored = release.features.every((feature) =>
      user.exploredFeatures.some(
        (ef) =>
          ef.releaseId.toString() === releaseId &&
          ef.featureId.toString() === feature._id.toString()
      )
    );

    if (allFeaturesExplored) {
      user.lastExploredVersion = release.releaseVersion;
    }

    await user.save();

    sendSuccess(res, {
      success: true,
      message: 'Feature marked as explored',
      data: { allFeaturesExplored },
    });
  } catch (error) {
    logger.error('[Explorer] markFeatureAsExplored:', error);
    sendError(res, {
      success: false,
      message: 'Failed to mark feature as explored',
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Releases
  getAllReleases,
  getLatestRelease,
  getLatestReleaseForUser,
  createRelease,
  deleteRelease,
  // Features
  addFeature,
  updateFeature,
  deleteFeature,
  reorderFeatures,
  // User Exploration
  markFeatureAsExplored,
};
