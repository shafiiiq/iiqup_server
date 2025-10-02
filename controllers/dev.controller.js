const devServices = require('../services/dev-services');
const path = require('path');
const { putObject } = require('../s3bucket/s3.bucket');

class DevController {
    static async uploadImage(req, res) {
        try {
            const { id, schema, files } = req.body;

            if (!files || files.length === 0) {
                return res.status(400).json({
                    status: 400,
                    message: 'At least one media file is required'
                });
            }

            const isVideoFile = (mimeType, fileName) => {
                if (mimeType) {
                    const normalizedMimeType = mimeType.toLowerCase();
                    if (normalizedMimeType === 'video' || normalizedMimeType.startsWith('video/')) {
                        return true;
                    }
                }

                if (fileName) {
                    const ext = path.extname(fileName).toLowerCase();
                    const videoExtensions = ['.mp4', '.webm', '.ogg', '.avi', '.mov', '.wmv', '.flv', '.m4v', '.3gp', '.mkv'];
                    return videoExtensions.includes(ext);
                }

                return false;
            };

            // Generate upload URLs for each file
            const uploadData = await Promise.all(
                files.map(async (file, index) => {
                    const ext = path.extname(file.fileName);
                    const finalFilename = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${ext}`;
                    const s3Key = `dev/admin/shafiiq/portfolio/${schema}/${id}-${index}-${finalFilename}`;

                    // Get presigned upload URL
                    const uploadUrl = await putObject(
                        file.fileName,
                        s3Key,
                        file.mimeType
                    );

                    const isVideo = isVideoFile(file.mimeType, file.fileName);

                    return {
                        fileName: finalFilename,
                        originalName: file.fileName,
                        filePath: s3Key,
                        mimeType: file.mimeType,
                        type: isVideo ? 'video' : 'photo',
                        uploadUrl: uploadUrl,
                        uploadDate: new Date()
                    };
                })
            );

            // Create/update portfolio record
            const devData = {
                id,
                schema,
                mediaFiles: uploadData.map(item => ({
                    fileName: item.fileName,
                    originalName: item.originalName,
                    filePath: item.filePath,
                    mimeType: item.mimeType,
                    type: item.type,
                    uploadDate: item.uploadDate
                }))
            };

            const result = await devServices.prepareDevData(devData);

            res.status(202).json({
                status: 202,
                message: 'Media files uploaded successfully',
                data: {
                    portfolio: result,
                    uploadData: uploadData
                }
            });
        } catch (error) {
            console.error('Error uploading media:', error);
            res.status(500).json({
                status: 500,
                message: 'Failed to upload media',
                error: error.message
            });
        }
    }

    static async getPortfolioDetails(req, res, next) {
        try {
            const { id } = req.params;
            const complaint = await devServices.getPortfolioById(id);

            if (!complaint) {
                return res.status(404).json({ error: 'Complaint not found' });
            }

            res.json(complaint);
        } catch (error) {
            next(error);
        }
    }

    static async getAllPortfolio(req, res, next) {
        try {
            const complaint = await devServices.getFullPortfolio();

            if (!complaint) {
                return res.status(404).json({ error: 'Complaints not found' });
            }

            res.json(complaint);
        } catch (error) {
            next(error);
        }
    }
}

module.exports = DevController;