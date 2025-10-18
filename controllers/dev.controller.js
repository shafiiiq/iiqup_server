const devServices = require('../services/dev-services');
const path = require('path');
const { putObject } = require('../s3bucket/s3.bucket');

class DevController {
    // dev porfolio s3 related services - BEGIN
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
    // dev porfolio s3 related services - END
    // Profile methods
    static async getProfile(req, res) {
        try {
            const profile = await devServices.getProfile();
            res.status(200).json({
                success: true,
                data: profile
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    static async updateProfile(req, res) {
        try {
            const profile = await devServices.updateProfile(req.body);
            res.status(200).json({
                success: true,
                data: profile,
                message: 'Profile updated successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Experience methods
    static async getExperience(req, res) {
        try {
            const experience = await devServices.getExperience();
            res.status(200).json({
                success: true,
                data: experience
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    static async addExperience(req, res) {
        try {
            const experience = await devServices.addExperience(req.body);
            res.status(201).json({
                success: true,
                data: experience,
                message: 'Experience added successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    static async updateExperience(req, res) {
        try {
            const experience = await devServices.updateExperience(req.params.id, req.body);
            if (!experience) {
                return res.status(404).json({
                    success: false,
                    message: 'Experience not found'
                });
            }
            res.status(200).json({
                success: true,
                data: experience,
                message: 'Experience updated successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    static async deleteExperience(req, res) {
        try {
            const experience = await devServices.deleteExperience(req.params.id);
            if (!experience) {
                return res.status(404).json({
                    success: false,
                    message: 'Experience not found'
                });
            }
            res.status(200).json({
                success: true,
                message: 'Experience deleted successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Projects methods
    static async getProjects(req, res) {
        try {
            const projects = await devServices.getProjects();
            res.status(200).json({
                success: true,
                data: projects
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    static async addProject(req, res) {
        try {
            const project = await devServices.addProject(req.body);
            res.status(201).json({
                success: true,
                data: project,
                message: 'Project added successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    static async updateProject(req, res) {
        try {
            const project = await devServices.updateProject(req.params.id, req.body);
            if (!project) {
                return res.status(404).json({
                    success: false,
                    message: 'Project not found'
                });
            }
            res.status(200).json({
                success: true,
                data: project,
                message: 'Project updated successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    static async deleteProject(req, res) {
        try {
            const project = await devServices.deleteProject(req.params.id);
            if (!project) {
                return res.status(404).json({
                    success: false,
                    message: 'Project not found'
                });
            }
            res.status(200).json({
                success: true,
                message: 'Project deleted successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Skills methods
    static async getSkills(req, res) {
        try {
            const skills = await devServices.getSkills();
            res.status(200).json({
                success: true,
                data: skills
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    static async addSkill(req, res) {
        try {
            const skill = await devServices.addSkill(req.body);
            res.status(201).json({
                success: true,
                data: skill,
                message: 'Skill added successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    static async updateSkill(req, res) {
        try {
            const skill = await devServices.updateSkill(req.params.id, req.body);
            if (!skill) {
                return res.status(404).json({
                    success: false,
                    message: 'Skill not found'
                });
            }
            res.status(200).json({
                success: true,
                data: skill,
                message: 'Skill updated successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    static async deleteSkill(req, res) {
        try {
            const skill = await devServices.deleteSkill(req.params.id);
            if (!skill) {
                return res.status(404).json({
                    success: false,
                    message: 'Skill not found'
                });
            }
            res.status(200).json({
                success: true,
                message: 'Skill deleted successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Education methods
    static async getEducation(req, res) {
        try {
            const education = await devServices.getEducation();
            res.status(200).json({
                success: true,
                data: education
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    static async addEducation(req, res) {
        try {
            const education = await devServices.addEducation(req.body);
            res.status(201).json({
                success: true,
                data: education,
                message: 'Education added successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    static async updateEducation(req, res) {
        try {
            const education = await devServices.updateEducation(req.params.id, req.body);
            if (!education) {
                return res.status(404).json({
                    success: false,
                    message: 'Education not found'
                });
            }
            res.status(200).json({
                success: true,
                data: education,
                message: 'Education updated successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    static async deleteEducation(req, res) {
        try {
            const education = await devServices.deleteEducation(req.params.id);
            if (!education) {
                return res.status(404).json({
                    success: false,
                    message: 'Education not found'
                });
            }
            res.status(200).json({
                success: true,
                message: 'Education deleted successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Certificates methods
    static async getCertificates(req, res) {
        try {
            const certificates = await devServices.getCertificates();
            res.status(200).json({
                success: true,
                data: certificates
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    static async addCertificate(req, res) {
        try {
            const certificate = await devServices.addCertificate(req.body);
            res.status(201).json({
                success: true,
                data: certificate,
                message: 'Certificate added successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    static async updateCertificate(req, res) {
        try {
            const certificate = await devServices.updateCertificate(req.params.id, req.body);
            if (!certificate) {
                return res.status(404).json({
                    success: false,
                    message: 'Certificate not found'
                });
            }
            res.status(200).json({
                success: true,
                data: certificate,
                message: 'Certificate updated successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    static async deleteCertificate(req, res) {
        try {
            const certificate = await devServices.deleteCertificate(req.params.id);
            if (!certificate) {
                return res.status(404).json({
                    success: false,
                    message: 'Certificate not found'
                });
            }
            res.status(200).json({
                success: true,
                message: 'Certificate deleted successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Services methods
    static async getServices(req, res) {
        try {
            const services = await devServices.getServices();
            res.status(200).json({
                success: true,
                data: services
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    static async addService(req, res) {
        try {
            const service = await devServices.addService(req.body);
            res.status(201).json({
                success: true,
                data: service,
                message: 'Service added successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    static async updateService(req, res) {
        try {
            const service = await devServices.updateService(req.params.id, req.body);
            if (!service) {
                return res.status(404).json({
                    success: false,
                    message: 'Service not found'
                });
            }
            res.status(200).json({
                success: true,
                data: service,
                message: 'Service updated successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    static async deleteService(req, res) {
        try {
            const service = await devServices.deleteService(req.params.id);
            if (!service) {
                return res.status(404).json({
                    success: false,
                    message: 'Service not found'
                });
            }
            res.status(200).json({
                success: true,
                message: 'Service deleted successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Stats methods
    static async getStats(req, res) {
        try {
            const stats = await devServices.getStats();
            res.status(200).json({
                success: true,
                data: stats
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    static async updateStats(req, res) {
        try {
            const stats = await devServices.updateStats(req.body);
            res.status(200).json({
                success: true,
                data: stats,
                message: 'Stats updated successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Contact methods
    static async getContact(req, res) {
        try {
            const contact = await devServices.getContact();
            res.status(200).json({
                success: true,
                data: contact
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    static async updateContact(req, res) {
        try {
            const contact = await devServices.updateContact(req.body);
            res.status(200).json({
                success: true,
                data: contact,
                message: 'Contact updated successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
    // dev porfolio mongo db related services - BEGIN
}

module.exports = DevController;