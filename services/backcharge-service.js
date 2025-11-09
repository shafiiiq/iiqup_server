// services/backchargeService.js
const Backcharge = require('../models/backcharge.model');

class BackchargeService {
    // Get all backcharge reports
    async getAllBackchargeReports() {
        try {
            const backchargeReports = await Backcharge.find()
                .sort({ createdAt: -1 })
                .lean();

            return backchargeReports;
        } catch (error) {
            throw new Error(`Error retrieving backcharge reports: ${error.message}`);
        }
    }

    // Get backcharge report by ID
    async getBackchargeById(id) {
        try {
            const backchargeReport = await Backcharge.findById(id).lean();
            return backchargeReport;
        } catch (error) {
            throw new Error(`Error retrieving backcharge report by ID: ${error.message}`);
        }
    }

    // Get backcharge report by report number
    async getBackchargeByReportNo(reportNo) {
        try {
            const backchargeReport = await Backcharge.findOne({ reportNo }).lean();
            return backchargeReport;
        } catch (error) {
            throw new Error(`Error retrieving backcharge report by report number: ${error.message}`);
        }
    }

    async getBackchargeByRefNo(refNo) {
        try {
            const backchargeReport = await Backcharge.findOne({ refNo }).lean();
            return backchargeReport;
        } catch (error) {
            throw new Error(`Error retrieving backcharge report by report number: ${error.message}`);
        }
    }

    // Add new backcharge report
    async addBackcharge(backchargeData) {
        try {
            // Process scope of work lines
            const scopeOfWorkLines = [];
            if (backchargeData.scopeOfWork) {
                scopeOfWorkLines.push({
                    lineNumber: 1,
                    text: backchargeData.scopeOfWork
                });
            }
            if (backchargeData.scopeLine2Text) {
                scopeOfWorkLines.push({
                    lineNumber: 2,
                    text: backchargeData.scopeLine2Text
                });
            }

            // Process workshop comments/work summary lines
            const workSummaryLines = [];
            if (backchargeData.workshopComments) {
                workSummaryLines.push({
                    lineNumber: 1,
                    text: backchargeData.workshopComments
                });
            }
            if (backchargeData.workSummaryLine2) {
                workSummaryLines.push({
                    lineNumber: 2,
                    text: backchargeData.workSummaryLine2
                });
            }

            const newBackcharge = new Backcharge({
                reportNo: backchargeData.reportNo,
                refNo: backchargeData.refNo || 'ATE193-09-25',
                equipmentType: backchargeData.equipmentType,
                plateNo: backchargeData.plateNo,
                model: backchargeData.model,
                supplierName: backchargeData.supplierName,
                contactPerson: backchargeData.contactPerson,
                siteLocation: backchargeData.siteLocation,
                date: backchargeData.date,

                // Scope of work with line support
                scopeOfWork: {
                    combinedText: backchargeData.scopeOfWork + (backchargeData.scopeLine2Text ? ' ' + backchargeData.scopeLine2Text : ''),
                    lines: scopeOfWorkLines
                },

                // Workshop comments/work summary with line support
                workshopComments: {
                    combinedText: backchargeData.workshopComments + (backchargeData.workSummaryLine2 ? ' ' + backchargeData.workSummaryLine2 : ''),
                    lines: workSummaryLines
                },

                // Spare parts table
                sparePartsTable: backchargeData.tableRows || [],

                // Cost summary
                costSummary: {
                    sparePartsCost: parseFloat(backchargeData.sparePartsCost) || 0,
                    labourCharges: parseFloat(backchargeData.labourCharges) || 0,
                    totalCost: parseFloat(backchargeData.totalCost) || 0,
                    approvedDeduction: parseFloat(backchargeData.approvedDeduction) || 0
                },

                // Authorization signatures
                signatures: {
                    workshopManager: 'Firoz Khan',
                    purchaseManager: 'Abdul Malik',
                    operationsManager: 'Suresh Kanth',
                    authorizedSignatory: 'Ahammed Kamal'
                },

                status: 'draft'
            });

            const savedBackcharge = await newBackcharge.save();
            return savedBackcharge;
        } catch (error) {
            throw new Error(`Error creating backcharge report: ${error.message}`);
        }
    }

    // Update backcharge report
    async updateBackcharge(id, updateData) {
        try {
            // Process scope of work lines if updated
            if (updateData.scopeOfWork || updateData.scopeLine2Text) {
                const scopeOfWorkLines = [];
                if (updateData.scopeOfWork) {
                    scopeOfWorkLines.push({
                        lineNumber: 1,
                        text: updateData.scopeOfWork
                    });
                }
                if (updateData.scopeLine2Text) {
                    scopeOfWorkLines.push({
                        lineNumber: 2,
                        text: updateData.scopeLine2Text
                    });
                }

                updateData.scopeOfWork = {
                    combinedText: (updateData.scopeOfWork || '') + (updateData.scopeLine2Text ? ' ' + updateData.scopeLine2Text : ''),
                    lines: scopeOfWorkLines
                };

                // Remove individual line fields from update data
                delete updateData.scopeLine2Text;
            }

            // Process workshop comments lines if updated
            if (updateData.workshopComments || updateData.workSummaryLine2) {
                const workSummaryLines = [];
                if (updateData.workshopComments) {
                    workSummaryLines.push({
                        lineNumber: 1,
                        text: updateData.workshopComments
                    });
                }
                if (updateData.workSummaryLine2) {
                    workSummaryLines.push({
                        lineNumber: 2,
                        text: updateData.workSummaryLine2
                    });
                }

                updateData.workshopComments = {
                    combinedText: (updateData.workshopComments || '') + (updateData.workSummaryLine2 ? ' ' + updateData.workSummaryLine2 : ''),
                    lines: workSummaryLines
                };

                // Remove individual line fields from update data
                delete updateData.workSummaryLine2;
            }

            // Update cost summary if provided
            if (updateData.sparePartsCost || updateData.labourCharges || updateData.totalCost || updateData.approvedDeduction) {
                updateData.costSummary = {
                    sparePartsCost: parseFloat(updateData.sparePartsCost) || 0,
                    labourCharges: parseFloat(updateData.labourCharges) || 0,
                    totalCost: parseFloat(updateData.totalCost) || 0,
                    approvedDeduction: parseFloat(updateData.approvedDeduction) || 0
                };

                // Remove individual cost fields
                delete updateData.sparePartsCost;
                delete updateData.labourCharges;
                delete updateData.totalCost;
                delete updateData.approvedDeduction;
            }

            // Update spare parts table if provided
            if (updateData.tableRows) {
                updateData.sparePartsTable = updateData.tableRows;
                delete updateData.tableRows;
            }

            updateData.updatedAt = new Date();

            const updatedBackcharge = await Backcharge.findByIdAndUpdate(
                id,
                updateData,
                { new: true, runValidators: true }
            );

            return updatedBackcharge;
        } catch (error) {
            throw new Error(`Error updating backcharge report: ${error.message}`);
        }
    }

    // Delete backcharge report
    async deleteBackcharge(id) {
        try {
            const deletedBackcharge = await Backcharge.findByIdAndDelete(id);
            return deletedBackcharge;
        } catch (error) {
            throw new Error(`Error deleting backcharge report: ${error.message}`);
        }
    }

    // Get latest backcharge reference number
    async getLatestBackchargeRef() {
        try {
            // Find the latest backcharge by refNo, extract the number part
            const latestBackcharge = await Backcharge.findOne()
                .sort({ createdAt: -1 })
                .select('refNo')
                .lean();

            if (!latestBackcharge || !latestBackcharge.refNo) {
                return 140; // Default starting number
            }

            // Extract number from refNo format: ATE193-09-25
            const refParts = latestBackcharge.refNo.split('-');

            if (refParts.length >= 1 && refParts[0].startsWith('ATE')) {
                // Extract numeric part from "ATE193" -> "193"
                const numericString = refParts[0].replace('ATE', '');
                const numericPart = parseInt(numericString) || 140;
                return numericPart;
            }

            return 140; // Fallback
        } catch (error) {
            throw new Error(`Error retrieving latest backcharge reference: ${error.message}`);
        }
    }

    // Get backcharge reports with pagination
    async getBackchargeReportsWithPagination(page = 1, limit = 10, filters = {}) {
        try {
            const skip = (page - 1) * limit;

            let query = {};

            // Apply filters
            if (filters.reportNo) {
                query.reportNo = new RegExp(filters.reportNo, 'i');
            }
            if (filters.equipmentType) {
                query.equipmentType = new RegExp(filters.equipmentType, 'i');
            }
            if (filters.supplierName) {
                query.supplierName = new RegExp(filters.supplierName, 'i');
            }
            if (filters.status) {
                query.status = filters.status;
            }
            if (filters.dateFrom || filters.dateTo) {
                query.date = {};
                if (filters.dateFrom) {
                    query.date.$gte = new Date(filters.dateFrom);
                }
                if (filters.dateTo) {
                    query.date.$lte = new Date(filters.dateTo);
                }
            }

            const backchargeReports = await Backcharge.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean();

            const total = await Backcharge.countDocuments(query);

            return {
                reports: backchargeReports,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(total / limit),
                    totalReports: total,
                    hasNext: page < Math.ceil(total / limit),
                    hasPrev: page > 1
                }
            };
        } catch (error) {
            throw new Error(`Error retrieving paginated backcharge reports: ${error.message}`);
        }
    }

    // Get backcharge statistics
    async getBackchargeStats() {
        try {
            const stats = await Backcharge.aggregate([
                {
                    $group: {
                        _id: null,
                        totalReports: { $sum: 1 },
                        totalCost: { $sum: "$costSummary.totalCost" },
                        totalDeductions: { $sum: "$costSummary.approvedDeduction" },
                        avgCost: { $avg: "$costSummary.totalCost" },
                        avgDeduction: { $avg: "$costSummary.approvedDeduction" }
                    }
                }
            ]);

            const statusStats = await Backcharge.aggregate([
                {
                    $group: {
                        _id: "$status",
                        count: { $sum: 1 }
                    }
                }
            ]);

            const monthlyStats = await Backcharge.aggregate([
                {
                    $group: {
                        _id: {
                            year: { $year: "$createdAt" },
                            month: { $month: "$createdAt" }
                        },
                        count: { $sum: 1 },
                        totalCost: { $sum: "$costSummary.totalCost" }
                    }
                },
                {
                    $sort: { "_id.year": -1, "_id.month": -1 }
                },
                {
                    $limit: 12
                }
            ]);

            return {
                overall: stats[0] || {
                    totalReports: 0,
                    totalCost: 0,
                    totalDeductions: 0,
                    avgCost: 0,
                    avgDeduction: 0
                },
                byStatus: statusStats,
                monthly: monthlyStats
            };
        } catch (error) {
            throw new Error(`Error retrieving backcharge statistics: ${error.message}`);
        }
    }

    // Search equipment by plate number
    async searchEquipmentByPlate(plateNo) {
        try {
            const equipment = await Backcharge.find({
                plateNo: new RegExp(plateNo, 'i')
            })
                .select('plateNo equipmentType model supplierName contactPerson')
                .limit(10)
                .lean();

            // Remove duplicates based on plate number
            const uniqueEquipment = equipment.reduce((acc, current) => {
                const existing = acc.find(item => item.plateNo === current.plateNo);
                if (!existing) {
                    acc.push(current);
                }
                return acc;
            }, []);

            return uniqueEquipment;
        } catch (error) {
            throw new Error(`Error searching equipment: ${error.message}`);
        }
    }

    // Search suppliers
    async searchSuppliers(supplierName) {
        try {
            const suppliers = await Backcharge.find({
                supplierName: new RegExp(supplierName, 'i')
            })
                .select('supplierName contactPerson')
                .limit(10)
                .lean();

            // Remove duplicates and format response
            const uniqueSuppliers = suppliers.reduce((acc, current) => {
                const existing = acc.find(item => item.name === current.supplierName);
                if (!existing) {
                    acc.push({
                        name: current.supplierName,
                        contactPerson: current.contactPerson
                    });
                }
                return acc;
            }, []);

            return uniqueSuppliers;
        } catch (error) {
            throw new Error(`Error searching suppliers: ${error.message}`);
        }
    }

    // Search sites
    async searchSites(siteLocation) {
        try {
            const sites = await Backcharge.find({
                siteLocation: new RegExp(siteLocation, 'i')
            })
                .select('siteLocation')
                .limit(10)
                .lean();

            // Remove duplicates and format response
            const uniqueSites = sites.reduce((acc, current) => {
                const existing = acc.find(item => item.location === current.siteLocation);
                if (!existing) {
                    acc.push({
                        location: current.siteLocation
                    });
                }
                return acc;
            }, []);

            return uniqueSites;
        } catch (error) {
            throw new Error(`Error searching sites: ${error.message}`);
        }
    }
}

module.exports = new BackchargeService();