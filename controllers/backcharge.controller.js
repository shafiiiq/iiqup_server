// controllers/backchargeController.js
const backchargeService = require('../services/backcharge-service');

class BackchargeController {
    // Get all backcharge reports
    async getAllBackchargeReports(req, res) {
        try {
            const backchargeReports = await backchargeService.getAllBackchargeReports();

            return res.status(200).json({
                success: true,
                message: 'Backcharge reports retrieved successfully',
                data: backchargeReports
            });
        } catch (error) {
            console.error('Error in getAllBackchargeReports:', error);
            return res.status(500).json({
                success: false,
                message: 'Error retrieving backcharge reports',
                error: error.message
            });
        }
    }

    // Get backcharge report by ID
    async getBackchargeById(req, res) {
        try {
            const { id } = req.params;
            const backchargeReport = await backchargeService.getBackchargeById(id);

            if (!backchargeReport) {
                return res.status(404).json({
                    success: false,
                    message: 'Backcharge report not found'
                });
            }

            return res.status(200).json({
                success: true,
                message: 'Backcharge report retrieved successfully',
                data: backchargeReport
            });
        } catch (error) {
            console.error('Error in getBackchargeById:', error);
            return res.status(500).json({
                success: false,
                message: 'Error retrieving backcharge report',
                error: error.message
            });
        }
    }

    // Get backcharge report by report number
    async getBackchargeByReportNo(req, res) {
        try {
            const { reportNo } = req.params;
            const backchargeReport = await backchargeService.getBackchargeByReportNo(reportNo);

            if (!backchargeReport) {
                return res.status(404).json({
                    success: false,
                    message: 'Backcharge report not found'
                });
            }

            return res.status(200).json({
                success: true,
                message: 'Backcharge report retrieved successfully',
                data: backchargeReport
            });
        } catch (error) {
            console.error('Error in getBackchargeByReportNo:', error);
            return res.status(500).json({
                success: false,
                message: 'Error retrieving backcharge report',
                error: error.message
            });
        }
    }

    async getBackchargeByRefNo(req, res) {
        try {
            const { refNo } = req.params;
            const backchargeReport = await backchargeService.getBackchargeByRefNo(refNo);

            if (!backchargeReport) {
                return res.status(404).json({
                    success: false,
                    message: 'Backcharge report not found'
                });
            }

            return res.status(200).json({
                success: true,
                message: 'Backcharge report retrieved successfully',
                data: backchargeReport
            });
        } catch (error) {
            console.error('Error in getBackchargeByReportNo:', error);
            return res.status(500).json({
                success: false,
                message: 'Error retrieving backcharge report',
                error: error.message
            });
        }
    }

    // Add new backcharge report
    async addBackcharge(req, res) {
        try {
            const backchargeData = req.body;

            // Validate required fields
            if (!backchargeData.reportNo || !backchargeData.equipmentType || !backchargeData.plateNo) {
                return res.status(400).json({
                    success: false,
                    message: 'Report number, equipment type, and plate number are required'
                });
            }

            // Check if backcharge report already exists
            const existingReport = await backchargeService.getBackchargeByReportNo(backchargeData.reportNo);
            if (existingReport) {
                return res.status(409).json({
                    success: false,
                    message: 'Backcharge report with this report number already exists'
                });
            }

            const newBackchargeReport = await backchargeService.addBackcharge(backchargeData);

            return res.status(201).json({
                success: true,
                message: 'Backcharge report created successfully',
                data: newBackchargeReport
            });
        } catch (error) {
            console.error('Error in addBackcharge:', error);
            return res.status(500).json({
                success: false,
                message: 'Error creating backcharge report',
                error: error.message
            });
        }
    }

    // Update backcharge report
    async updateBackcharge(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;

            const updatedReport = await backchargeService.updateBackcharge(id, updateData);

            if (!updatedReport) {
                return res.status(404).json({
                    success: false,
                    message: 'Backcharge report not found'
                });
            }

            return res.status(200).json({
                success: true,
                message: 'Backcharge report updated successfully',
                data: updatedReport
            });
        } catch (error) {
            console.error('Error in updateBackcharge:', error);
            return res.status(500).json({
                success: false,
                message: 'Error updating backcharge report',
                error: error.message
            });
        }
    }

    // Delete backcharge report
    async deleteBackcharge(req, res) {
        try {
            const { id } = req.params;

            const deletedReport = await backchargeService.deleteBackcharge(id);

            if (!deletedReport) {
                return res.status(404).json({
                    success: false,
                    message: 'Backcharge report not found'
                });
            }

            return res.status(200).json({
                success: true,
                message: 'Backcharge report deleted successfully'
            });
        } catch (error) {
            console.error('Error in deleteBackcharge:', error);
            return res.status(500).json({
                success: false,
                message: 'Error deleting backcharge report',
                error: error.message
            });
        }
    }

    // Get latest backcharge reference number
    async getLatestBackchargeRef(req, res) {
        try {
            const latestNumber = await backchargeService.getLatestBackchargeRef();

            return res.status(200).json({
                success: true,
                message: 'Latest backcharge reference retrieved successfully',
                data: {
                    latestNumber: latestNumber
                }
            });
        } catch (error) {
            console.error('Error in getLatestBackchargeRef:', error);
            return res.status(500).json({
                success: false,
                message: 'Error retrieving latest backcharge reference',
                error: error.message
            });
        }
    }

    // Search equipment by plate number
    async searchEquipmentByPlate(req, res) {
        try {
            const { plateNo } = req.query;

            if (!plateNo || plateNo.length < 2) {
                return res.status(400).json({
                    success: false,
                    message: 'Plate number must be at least 2 characters'
                });
            }

            const equipment = await backchargeService.searchEquipmentByPlate(plateNo);

            return res.status(200).json({
                success: true,
                message: 'Equipment search completed',
                data: equipment
            });
        } catch (error) {
            console.error('Error in searchEquipmentByPlate:', error);
            return res.status(500).json({
                success: false,
                message: 'Error searching equipment',
                error: error.message
            });
        }
    }

    // Search suppliers
    async searchSuppliers(req, res) {
        try {
            const { name } = req.query;

            if (!name || name.length < 2) {
                return res.status(400).json({
                    success: false,
                    message: 'Supplier name must be at least 2 characters'
                });
            }

            const suppliers = await backchargeService.searchSuppliers(name);

            return res.status(200).json({
                success: true,
                message: 'Supplier search completed',
                data: suppliers
            });
        } catch (error) {
            console.error('Error in searchSuppliers:', error);
            return res.status(500).json({
                success: false,
                message: 'Error searching suppliers',
                error: error.message
            });
        }
    }

    // Search sites
    async searchSites(req, res) {
        try {
            const { location } = req.query;

            if (!location || location.length < 2) {
                return res.status(400).json({
                    success: false,
                    message: 'Site location must be at least 2 characters'
                });
            }

            const sites = await backchargeService.searchSites(location);

            return res.status(200).json({
                success: true,
                message: 'Site search completed',
                data: sites
            });
        } catch (error) {
            console.error('Error in searchSites:', error);
            return res.status(500).json({
                success: false,
                message: 'Error searching sites',
                error: error.message
            });
        }
    }
}

module.exports = new BackchargeController();