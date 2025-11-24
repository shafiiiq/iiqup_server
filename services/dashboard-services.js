const { promises } = require('fs');
const serviceHistoryModel = require('../models/service-history.model.js');
const serviceReportModel = require('../models/service-report.model.js');
const maintananceHistoryModel = require('../models/maintanance-history.model.js');
const tyreModel = require('../models/tyre.model.js');
const batteryModel = require('../models/batery.model.js');
const stocksModel = require('../models/stocks.model.js');
const equipmnentModel = require('../models/equip.model.js');
const toolkitModel = require('../models/toolkit.model.js');

// Define all models with their source names
const models = [
    { model: serviceHistoryModel, source: 'serviceHistoryModel', content: 'service-history' },
    { model: serviceReportModel, source: 'serviceReportModel', content: 'service-report' },
    { model: maintananceHistoryModel, source: 'maintananceHistoryModel', content: 'maintanance-history' },
    { model: tyreModel, source: 'tyreModel', content: 'tyre-history' },
    { model: batteryModel, source: 'batteryModel', content: 'battery-history' },
    { model: equipmnentModel, source: 'equipmnentModel', content: 'equipment' },
    { model: stocksModel, source: 'stocksModel', content: 'stocks' },
    { model: toolkitModel, source: 'toolkitModel', content: 'toolkit' }
];

/**
 * Helper function to add source information to documents
 */
const addSourceInfo = (docs, source, content) => {
    return docs.map(doc => ({
        ...doc,
        source,
        content
    }));
};

/**
 * Helper function to get model-specific counts
 */
const getModelCounts = (updates) => {
    const counts = {};
    for (const { source } of models) {
        counts[source] = updates.filter(item => item.source === source).length;
    }
    return counts;
};

module.exports = {
    /**
     * Fetch today's updates from all models
     */
    fetchDailyUpdates: (data) => {
        return new Promise(async (resolve, reject) => {
            try {
                // Get current date and time
                const now = new Date();
                const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

                // Initialize result with separated arrays for each collection
                const updatesByCollection = {};
                // Also maintain a combined array for backward compatibility
                const allUpdates = [];

                // Process each model
                for (const { model, source, content } of models) {
                    const todayUpdates = await model.find({
                        $or: [
                            { createdAt: { $gte: todayStart } },
                            { updatedAt: { $gte: todayStart } }
                        ]
                    }).lean();

                    // Add source and content info
                    const updatesWithInfo = addSourceInfo(todayUpdates, source, content);

                    // Add to the collection-specific array
                    updatesByCollection[content] = updatesWithInfo;

                    // Also add to the combined array
                    allUpdates.push(...updatesWithInfo);
                }

                // Create result object
                const result = {
                    status: 200,
                    data: {
                        // Organized by collection type
                        serviceHistory: updatesByCollection['service-history'] || [],
                        serviceReports: updatesByCollection['service-report'] || [],
                        maintenanceHistory: updatesByCollection['maintanance-history'] || [],
                        tyreHistory: updatesByCollection['tyre-history'] || [],
                        batteryHistory: updatesByCollection['battery-history'] || [],
                        equipment: updatesByCollection['equipment'] || [],
                        stocks: updatesByCollection['stocks'] || [],
                        toolkit: updatesByCollection['toolkit'] || [],
                        // Combined data (for backward compatibility)
                        updates: allUpdates,
                        total: allUpdates.length,
                        modelCounts: getModelCounts(allUpdates)
                    }
                };

                resolve(result);
            } catch (err) {
                console.error('Error fetching daily updates:', err);
                reject({ status: 500, message: err.message || 'Failed to fetch daily updates' });
            }
        });
    },

    /**
     * Fetch weekly updates from all models
     */
    fetchWeeklyUpdates: (data) => {
        return new Promise(async (resolve, reject) => {
            try {
                // Get current date and time
                const now = new Date();
                const oneWeekAgo = new Date(now);
                oneWeekAgo.setDate(now.getDate() - 7);

                // Initialize result with separated arrays for each collection
                const updatesByCollection = {};
                // Also maintain a combined array for backward compatibility
                const allUpdates = [];

                // Process each model
                for (const { model, source, content } of models) {
                    const weeklyUpdates = await model.find({
                        $or: [
                            { createdAt: { $gte: oneWeekAgo } },
                            { updatedAt: { $gte: oneWeekAgo } }
                        ]
                    }).lean();

                    // Add source and content info
                    const updatesWithInfo = addSourceInfo(weeklyUpdates, source, content);

                    // Add to the collection-specific array
                    updatesByCollection[content] = updatesWithInfo;

                    // Also add to the combined array
                    allUpdates.push(...updatesWithInfo);
                }

                // Create result object
                const result = {
                    status: 200,
                    data: {
                        // Organized by collection type
                        serviceHistory: updatesByCollection['service-history'] || [],
                        serviceReports: updatesByCollection['service-report'] || [],
                        maintenanceHistory: updatesByCollection['maintanance-history'] || [],
                        tyreHistory: updatesByCollection['tyre-history'] || [],
                        batteryHistory: updatesByCollection['battery-history'] || [],
                        equipment: updatesByCollection['equipment'] || [],
                        stocks: updatesByCollection['stocks'] || [],
                        toolkit: updatesByCollection['toolkit'] || [],
                        // Combined data (for backward compatibility)
                        updates: allUpdates,
                        total: allUpdates.length,
                        modelCounts: getModelCounts(allUpdates)
                    }
                };

                resolve(result);
            } catch (err) {
                console.error('Error fetching weekly updates:', err);
                reject({ status: 500, message: err.message || 'Failed to fetch weekly updates' });
            }
        });
    },

    /**
     * Fetch monthly updates from all models
     */
    fetchMonthlyUpdates: (data) => {
        return new Promise(async (resolve, reject) => {
            try {
                // Get current date and time
                const now = new Date();
                const oneMonthAgo = new Date(now);
                oneMonthAgo.setMonth(now.getMonth() - 1);

                // Initialize result with separated arrays for each collection
                const updatesByCollection = {};
                // Also maintain a combined array for backward compatibility
                const allUpdates = [];

                // Process each model
                for (const { model, source, content } of models) {
                    const monthlyUpdates = await model.find({
                        $or: [
                            { createdAt: { $gte: oneMonthAgo } },
                            { updatedAt: { $gte: oneMonthAgo } }
                        ]
                    }).lean();

                    // Add source and content info
                    const updatesWithInfo = addSourceInfo(monthlyUpdates, source, content);

                    // Add to the collection-specific array
                    updatesByCollection[content] = updatesWithInfo;

                    // Also add to the combined array
                    allUpdates.push(...updatesWithInfo);
                }

                // Create result object
                const result = {
                    status: 200,
                    data: {
                        // Organized by collection type
                        serviceHistory: updatesByCollection['service-history'] || [],
                        serviceReports: updatesByCollection['service-report'] || [],
                        maintenanceHistory: updatesByCollection['maintanance-history'] || [],
                        tyreHistory: updatesByCollection['tyre-history'] || [],
                        batteryHistory: updatesByCollection['battery-history'] || [],
                        equipment: updatesByCollection['equipment'] || [],
                        stocks: updatesByCollection['stocks'] || [],
                        toolkit: updatesByCollection['toolkit'] || [],
                        // Combined data (for backward compatibility)
                        updates: allUpdates,
                        total: allUpdates.length,
                        modelCounts: getModelCounts(allUpdates)
                    }
                };

                resolve(result);
            } catch (err) {
                console.error('Error fetching monthly updates:', err);
                reject({ status: 500, message: err.message || 'Failed to fetch monthly updates' });
            }
        });
    },

    /**
     * Fetch yearly updates from all models
     */
    fetchYearlyUpdates: (data) => {
        return new Promise(async (resolve, reject) => {
            try {
                // Get current date and time
                const now = new Date();
                const oneYearAgo = new Date(now);
                oneYearAgo.setFullYear(now.getFullYear() - 1);


                // Initialize result with separated arrays for each collection
                const updatesByCollection = {};
                // Also maintain a combined array for backward compatibility
                const allUpdates = [];

                // Process each model
                for (const { model, source, content } of models) {
                    const yearlyUpdates = await model.find({
                        $or: [
                            { createdAt: { $gte: oneYearAgo } },
                            { updatedAt: { $gte: oneYearAgo } }
                        ]
                    }).lean();

                    // Add source and content info
                    const updatesWithInfo = addSourceInfo(yearlyUpdates, source, content);

                    // Add to the collection-specific array
                    updatesByCollection[content] = updatesWithInfo;

                    // Also add to the combined array
                    allUpdates.push(...updatesWithInfo);
                }

                // Create result object
                const result = {
                    status: 200,
                    data: {
                        // Organized by collection type
                        serviceHistory: updatesByCollection['service-history'] || [],
                        serviceReports: updatesByCollection['service-report'] || [],
                        maintenanceHistory: updatesByCollection['maintanance-history'] || [],
                        tyreHistory: updatesByCollection['tyre-history'] || [],
                        batteryHistory: updatesByCollection['battery-history'] || [],
                        equipment: updatesByCollection['equipment'] || [],
                        stocks: updatesByCollection['stocks'] || [],
                        toolkit: updatesByCollection['toolkit'] || [],
                        // Combined data (for backward compatibility)
                        updates: allUpdates,
                        total: allUpdates.length,
                        modelCounts: getModelCounts(allUpdates)
                    }
                };

                resolve(result);
            } catch (err) {
                console.error('Error fetching yearly updates:', err);
                reject({ status: 500, message: err.message || 'Failed to fetch yearly updates' });
            }
        });
    },

    /**
     * Helper function to format data by collection
     */
    _formatDataByCollection: (updatesByCollection) => {
        return {
            // Organized by collection type
            serviceHistory: updatesByCollection['service-history'] || [],
            serviceReports: updatesByCollection['service-report'] || [],
            maintenanceHistory: updatesByCollection['maintanance-history'] || [],
            tyreHistory: updatesByCollection['tyre-history'] || [],
            batteryHistory: updatesByCollection['battery-history'] || [],
            equipment: updatesByCollection['equipment'] || [],
            stocks: updatesByCollection['stocks'] || [],
            toolkit: updatesByCollection['toolkit'] || []
        };
    },

    /**
     * Fetch all updates (daily, weekly, monthly, yearly) at once
     */
    fetchAllUpdates: (data) => {
        return new Promise(async (resolve, reject) => {
            try {
                const [dailyResult, weeklyResult, monthlyResult, yearlyResult] = await Promise.all([
                    module.exports.fetchDailyUpdates(data),
                    module.exports.fetchWeeklyUpdates(data),
                    module.exports.fetchMonthlyUpdates(data),
                    module.exports.fetchYearlyUpdates(data)
                ]);

                const result = {
                    status: 200,
                    data: {
                        daily: dailyResult.data,
                        weekly: weeklyResult.data,
                        monthly: monthlyResult.data,
                        yearly: yearlyResult.data
                    }
                };

                resolve(result);
            } catch (err) {
                console.error('Error fetching all updates:', err);
                reject({ status: 500, message: err.message || 'Failed to fetch all updates' });
            }
        });
    },

    /**
 * Fetch last 5 days comparison
 */
    fetchLast5DaysComparison: () => {
        return new Promise(async (resolve, reject) => {
            try {
                const now = new Date();
                const comparisonData = [];

                // Loop through last 5 days
                for (let i = 0; i < 5; i++) {
                    const dayStart = new Date(now);
                    dayStart.setDate(now.getDate() - i);
                    dayStart.setHours(0, 0, 0, 0);

                    const dayEnd = new Date(dayStart);
                    dayEnd.setHours(23, 59, 59, 999);

                    const dayData = {
                        date: dayStart.toISOString().split('T')[0],
                        collections: {}
                    };

                    // Process each model
                    for (const { model, source, content } of models) {
                        const count = await model.countDocuments({
                            $or: [
                                { createdAt: { $gte: dayStart, $lte: dayEnd } },
                                { updatedAt: { $gte: dayStart, $lte: dayEnd } }
                            ]
                        });

                        dayData.collections[content] = count;
                    }

                    // Calculate total for the day
                    dayData.total = Object.values(dayData.collections).reduce((sum, count) => sum + count, 0);

                    comparisonData.push(dayData);
                }

                resolve({
                    status: 200,
                    data: {
                        period: 'last-5-days',
                        comparison: comparisonData.reverse() // Oldest to newest
                    }
                });
            } catch (err) {
                console.error('Error fetching last 5 days comparison:', err);
                reject({ status: 500, message: err.message || 'Failed to fetch last 5 days comparison' });
            }
        });
    },

    /**
     * Fetch last 5 months comparison
     */
    fetchLast5MonthsComparison: () => {
        return new Promise(async (resolve, reject) => {
            try {
                const now = new Date();
                const comparisonData = [];

                // Loop through last 5 months
                for (let i = 0; i < 5; i++) {
                    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
                    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);

                    const monthData = {
                        month: monthStart.toLocaleString('default', { month: 'long', year: 'numeric' }),
                        collections: {}
                    };

                    // Process each model
                    for (const { model, source, content } of models) {
                        const count = await model.countDocuments({
                            $or: [
                                { createdAt: { $gte: monthStart, $lte: monthEnd } },
                                { updatedAt: { $gte: monthStart, $lte: monthEnd } }
                            ]
                        });

                        monthData.collections[content] = count;
                    }

                    // Calculate total for the month
                    monthData.total = Object.values(monthData.collections).reduce((sum, count) => sum + count, 0);

                    comparisonData.push(monthData);
                }

                resolve({
                    status: 200,
                    data: {
                        period: 'last-5-months',
                        comparison: comparisonData.reverse() // Oldest to newest
                    }
                });
            } catch (err) {
                console.error('Error fetching last 5 months comparison:', err);
                reject({ status: 500, message: err.message || 'Failed to fetch last 5 months comparison' });
            }
        });
    },

    /**
     * Fetch last 5 years comparison
     */
    fetchLast5YearsComparison: () => {
        return new Promise(async (resolve, reject) => {
            try {
                const now = new Date();
                const comparisonData = [];

                // Loop through last 5 years
                for (let i = 0; i < 5; i++) {
                    const yearStart = new Date(now.getFullYear() - i, 0, 1);
                    const yearEnd = new Date(now.getFullYear() - i, 11, 31, 23, 59, 59, 999);

                    const yearData = {
                        year: yearStart.getFullYear(),
                        collections: {}
                    };

                    // Process each model
                    for (const { model, source, content } of models) {
                        const count = await model.countDocuments({
                            $or: [
                                { createdAt: { $gte: yearStart, $lte: yearEnd } },
                                { updatedAt: { $gte: yearStart, $lte: yearEnd } }
                            ]
                        });

                        yearData.collections[content] = count;
                    }

                    // Calculate total for the year
                    yearData.total = Object.values(yearData.collections).reduce((sum, count) => sum + count, 0);

                    comparisonData.push(yearData);
                }

                resolve({
                    status: 200,
                    data: {
                        period: 'last-5-years',
                        comparison: comparisonData.reverse() // Oldest to newest
                    }
                });
            } catch (err) {
                console.error('Error fetching last 5 years comparison:', err);
                reject({ status: 500, message: err.message || 'Failed to fetch last 5 years comparison' });
            }
        });
    }
}