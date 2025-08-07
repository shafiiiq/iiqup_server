const Mechanic = require('../models/mechanic.model');

/**
 * Service to handle all mechanic-related operations
 */
class MechanicService {
    /**
     * Insert a new mechanic with auto-incremented userId
     * @param {Object} mechanicData - Mechanic details
     * @returns {Promise} - Promise with status and data
     */
    async insertMechanics(mechanicData) {

        try {
            // Find the highest userId to ensure auto-incrementing
            const highestUserIdMechanic = await Mechanic.findOne()
                .sort({ userId: -1 })
                .limit(1);

            // Set userId to 1 if no mechanics exist yet, or increment from highest
            const nextUserId = highestUserIdMechanic ? highestUserIdMechanic.userId + 1 : 1;

            // Create mechanic with auto-incremented userId
            const newMechanic = new Mechanic({
                ...mechanicData,
                userId: nextUserId
            });

            // Save the mechanic
            const savedMechanic = await newMechanic.save();

            return {
                status: 201,
                message: 'Mechanic added successfully',
                data: savedMechanic
            };
        } catch (error) {
            // Handle validation errors
            if (error.name === 'ValidationError') {
                const messages = Object.values(error.errors).map(val => val.message);
                throw {
                    status: 400,
                    message: messages.join(', ')
                };
            }

            // Handle other errors
            throw {
                status: 500,
                message: error.message || 'Error adding mechanic'
            };
        }
    }

    /**
     * Fetch all mechanics from database
     * @returns {Promise} - Promise with status and data
     */
    async fetchMechanic() {
        try {
            const mechanics = await Mechanic.find();

            return {
                status: 200,
                message: 'Mechanics fetched successfully',
                count: mechanics.length,
                data: mechanics
            };
        } catch (error) {
            throw {
                status: 500,
                message: error.message || 'Error fetching mechanics'
            };
        }
    }

    /**
     * Get a mechanic by ID
     * @param {String} id - Mechanic ID
     * @returns {Promise} - Promise with mechanic data
     */
    async getMechanicById(id) {
        try {
            const mechanic = await Mechanic.findById(id);
            return mechanic;
        } catch (error) {
            throw {
                status: 500,
                message: error.message || 'Error fetching mechanic'
            };
        }
    }

    /**
     * Update mechanic by ID
     * @param {String} id - Mechanic ID
     * @param {Object} updateData - Updated mechanic data
     * @returns {Promise} - Promise with status and data
     */
    async mechanicUpdate(id, updateData) {
        try {
            // Prevent userId from being modified
            if (updateData.userId) {
                delete updateData.userId;
            }

            const updatedMechanic = await Mechanic.findByIdAndUpdate(
                id,
                { $set: updateData },
                {
                    new: true,
                    runValidators: true
                }
            );

            if (!updatedMechanic) {
                throw {
                    status: 404,
                    message: 'Mechanic not found'
                };
            }

            return {
                status: 200,
                message: 'Mechanic updated successfully',
                data: updatedMechanic
            };
        } catch (error) {
            // Handle validation errors
            if (error.name === 'ValidationError') {
                const messages = Object.values(error.errors).map(val => val.message);
                throw {
                    status: 400,
                    message: messages.join(', ')
                };
            }

            // Pass through custom errors
            if (error.status) {
                throw error;
            }

            // Handle other errors
            throw {
                status: 500,
                message: error.message || 'Error updating mechanic'
            };
        }
    }

    /**
     * Delete mechanic by ID
     * @param {String} id - Mechanic ID
     * @returns {Promise} - Promise with status and message
     */
    async mechanicDelete(id) {
        try {
            const deletedMechanic = await Mechanic.findByIdAndDelete(id);

            if (!deletedMechanic) {
                throw {
                    status: 404,
                    message: 'Mechanic not found'
                };
            }

            return {
                status: 200,
                message: 'Mechanic deleted successfully'
            };
        } catch (error) {
            // Pass through custom errors
            if (error.status) {
                throw error;
            }

            // Handle other errors
            throw {
                status: 500,
                message: error.message || 'Error deleting mechanic'
            };
        }
    }

    /**
     * Add toolkit to a mechanic
     * @param {String} mechanicId - Mechanic ID
     * @param {Object} toolkitData - Toolkit data
     * @returns {Promise} - Promise with status and data
     */
    async addToolkit(mechanicId, toolkitData) {
        try {
            const mechanic = await Mechanic.findById(mechanicId);

            if (!mechanic) {
                throw {
                    status: 404,
                    message: 'Mechanic not found'
                };
            }

            // Add toolkit to mechanic
            mechanic.toolkits.push(toolkitData);

            // Save the updated mechanic
            const updatedMechanic = await mechanic.save();

            return {
                status: 201,
                message: 'Toolkit added successfully',
                data: updatedMechanic
            };
        } catch (error) {
            // Handle validation errors
            if (error.name === 'ValidationError') {
                const messages = Object.values(error.errors).map(val => val.message);
                throw {
                    status: 400,
                    message: messages.join(', ')
                };
            }

            // Pass through custom errors
            if (error.status) {
                throw error;
            }

            // Handle other errors
            throw {
                status: 500,
                message: error.message || 'Error adding toolkit'
            };
        }
    }

    /**
     * Generate month name for given date
     * @param {Date} date - Date object
     * @returns {String} - Month and year in "Month Year" format
     */
    getMonthYearString(date) {
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        return `${months[date.getMonth()]} ${date.getFullYear()}`;
    }

    /**
     * Format date as DD-MM-YYYY
     * @param {Date} date - Date object
     * @returns {String} - Formatted date string
     */
    getFormattedDateString(date) {
        return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
    }

    /**
     * Add overtime record to a mechanic using the monthly structure
     * @param {String} mechanicId - Mechanic ID
     * @param {Object} overtimeData - Overtime data
     * @returns {Promise} - Promise with status and data
     */
    async addOvertime(mechanicId, overtimeData) {
        try {
            const mechanic = await Mechanic.findById(mechanicId);

            if (!mechanic) {
                throw {
                    status: 404,
                    message: 'Mechanic not found'
                };
            }

            // Convert the date to start of day for consistent comparison
            const dateToAdd = new Date(overtimeData.date);
            dateToAdd.setHours(0, 0, 0, 0);
            overtimeData.date = dateToAdd;

            // Generate month string in "Month Year" format (e.g., "May 2025")
            const monthYear = this.getMonthYearString(dateToAdd);

            // Generate formatted date string in "dd-mm-yyyy" format
            const formattedDate = this.getFormattedDateString(dateToAdd);

            // Initialize the workDetails array if not provided
            if (!overtimeData.workDetails) {
                overtimeData.workDetails = [];
            }

            // Prepare the overtime entry
            const overtimeEntry = {
                date: dateToAdd,
                formattedDate,
                regNo: overtimeData.regNo || [],
                times: overtimeData.times || [],
                workDetails: overtimeData.workDetails || [],
                totalTime: 0,  // Will be calculated by pre-save hook
                formattedTime: ''  // Will be calculated by pre-save hook
            };

            // Check if we already have this month in the monthlyOvertime array
            let monthIndex = mechanic.monthlyOvertime ?
                mechanic.monthlyOvertime.findIndex(mo => mo.month === monthYear) : -1;

            if (monthIndex === -1) {
                // Month doesn't exist, create a new monthly overtime entry
                if (!mechanic.monthlyOvertime) {
                    mechanic.monthlyOvertime = [];
                }

                mechanic.monthlyOvertime.push({
                    month: monthYear,
                    entries: [overtimeEntry],
                    totalMonthTime: 0,  // Will be calculated by pre-save hook
                    formattedMonthTime: '0h 0m'  // Will be calculated by pre-save hook
                });

                monthIndex = mechanic.monthlyOvertime.length - 1;
            } else {
                // Check if we already have an entry for this exact date
                const entryIndex = mechanic.monthlyOvertime[monthIndex].entries.findIndex(entry => {
                    const entryDate = new Date(entry.date);
                    entryDate.setHours(0, 0, 0, 0);
                    return entryDate.getTime() === dateToAdd.getTime();
                });

                if (entryIndex !== -1) {
                    // Entry for this date exists, merge the data
                    const existingEntry = mechanic.monthlyOvertime[monthIndex].entries[entryIndex];

                    // Merge regNo arrays (avoid duplicates)
                    if (overtimeData.regNo && overtimeData.regNo.length > 0) {
                        overtimeData.regNo.forEach(regNo => {
                            if (!existingEntry.regNo.includes(regNo)) {
                                existingEntry.regNo.push(regNo);
                            }
                        });
                    }

                    // Merge times arrays
                    if (overtimeData.times && overtimeData.times.length > 0) {
                        existingEntry.times.push(...overtimeData.times);
                    }

                    // Merge workDetails arrays
                    if (overtimeData.workDetails && overtimeData.workDetails.length > 0) {
                        existingEntry.workDetails.push(...overtimeData.workDetails);
                    }

                    // Mark modified arrays for proper saving
                    const monthlyOvertimeArrayPath = `monthlyOvertime.${monthIndex}.entries.${entryIndex}`;
                    mechanic.markModified(`${monthlyOvertimeArrayPath}.times`);
                    mechanic.markModified(`${monthlyOvertimeArrayPath}.regNo`);
                    mechanic.markModified(`${monthlyOvertimeArrayPath}.workDetails`);
                } else {
                    // Entry for this date doesn't exist, add it
                    mechanic.monthlyOvertime[monthIndex].entries.push(overtimeEntry);
                }
            }

            // Save the updated mechanic
            const updatedMechanic = await mechanic.save();

            // Get the added/updated overtime entry
            const addedMonthlyOvertime = updatedMechanic.monthlyOvertime[monthIndex];
            const addedEntry = addedMonthlyOvertime.entries.find(entry => {
                const entryDate = new Date(entry.date);
                entryDate.setHours(0, 0, 0, 0);
                return entryDate.getTime() === dateToAdd.getTime();
            });

            // Clean up old overtime data (older than 2 months)
            this.cleanupOldOvertimeData(mechanicId);
            return {
                status: 201,
                message: 'Overtime record added successfully',
                data: addedMonthlyOvertime
            };
        } catch (error) {
            // Handle validation errors
            if (error.name === 'ValidationError') {
                const messages = Object.values(error.errors).map(val => val.message);
                throw {
                    status: 400,
                    message: messages.join(', ')
                };
            }

            // Pass through custom errors
            if (error.status) {
                throw error;
            }

            // Handle other errors
            throw {
                status: 500,
                message: error.message || 'Error adding overtime'
            };
        }
    }

    /**
     * Clean up overtime data older than 2 months for a mechanic
     * @param {String} mechanicId - Mechanic ID
     * @returns {Promise} - Promise with deletion results
     */
    async cleanupOldOvertimeData(mechanicId) {
        try {
            // Calculate date 2 months ago
            const twoMonthsAgo = new Date();
            twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

            // Get the month string for 2 months ago
            const cutoffMonthYear = this.getMonthYearString(twoMonthsAgo);

            const mechanic = await Mechanic.findById(mechanicId);

            if (!mechanic) {
                throw {
                    status: 404,
                    message: 'Mechanic not found'
                };
            }

            // Remove months older than the cutoff month
            if (mechanic.monthlyOvertime && mechanic.monthlyOvertime.length > 0) {
                // First get all months in the system
                const months = mechanic.monthlyOvertime.map(mo => mo.month);

                // Filter out months that are older than the cutoff month
                // This requires comparing month and year strings
                const monthsToRemove = months.filter(month => {
                    const [monthName, yearStr] = month.split(' ');
                    const year = parseInt(yearStr);
                    const cutoffMonthParts = cutoffMonthYear.split(' ');
                    const cutoffYear = parseInt(cutoffMonthParts[1]);

                    if (year < cutoffYear) {
                        return true;
                    } else if (year === cutoffYear) {
                        const months = [
                            'January', 'February', 'March', 'April', 'May', 'June',
                            'July', 'August', 'September', 'October', 'November', 'December'
                        ];
                        const monthIndex = months.indexOf(monthName);
                        const cutoffMonthIndex = months.indexOf(cutoffMonthParts[0]);

                        return monthIndex < cutoffMonthIndex;
                    }

                    return false;
                });

                // Remove the months from the mechanic document
                if (monthsToRemove.length > 0) {
                    await Mechanic.updateOne(
                        { _id: mechanicId },
                        { $pull: { monthlyOvertime: { month: { $in: monthsToRemove } } } }
                    );
                }
            }

            return {
                status: 200,
                message: 'Old overtime data cleaned up',
                data: { mechanicId, cutoffDate: twoMonthsAgo }
            };
        } catch (error) {
            console.error('Error cleaning up old overtime data:', error);
            // We don't throw here since this is a background cleanup task
            return {
                status: 500,
                message: 'Error cleaning up old overtime data',
                error: error.message
            };
        }
    }

    /**
     * Clean up overtime data older than 2 months for all mechanics
     * @returns {Promise} - Promise with deletion results
     */
    async cleanupAllOldOvertimeData() {
        try {
            // Calculate date 2 months ago
            const twoMonthsAgo = new Date();
            twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

            // Get the month string for 2 months ago
            const cutoffMonthYear = this.getMonthYearString(twoMonthsAgo);

            // Get all months older than the cutoff month
            const mechanics = await Mechanic.find({});
            let totalCleanedRecords = 0;

            for (const mechanic of mechanics) {
                if (mechanic.monthlyOvertime && mechanic.monthlyOvertime.length > 0) {
                    const monthsToRemove = mechanic.monthlyOvertime
                        .filter(mo => {
                            const [monthName, yearStr] = mo.month.split(' ');
                            const year = parseInt(yearStr);
                            const cutoffMonthParts = cutoffMonthYear.split(' ');
                            const cutoffYear = parseInt(cutoffMonthParts[1]);

                            if (year < cutoffYear) {
                                return true;
                            } else if (year === cutoffYear) {
                                const months = [
                                    'January', 'February', 'March', 'April', 'May', 'June',
                                    'July', 'August', 'September', 'October', 'November', 'December'
                                ];
                                const monthIndex = months.indexOf(monthName);
                                const cutoffMonthIndex = months.indexOf(cutoffMonthParts[0]);

                                return monthIndex < cutoffMonthIndex;
                            }

                            return false;
                        })
                        .map(mo => mo.month);

                    if (monthsToRemove.length > 0) {
                        await Mechanic.updateOne(
                            { _id: mechanic._id },
                            { $pull: { monthlyOvertime: { month: { $in: monthsToRemove } } } }
                        );
                        totalCleanedRecords += monthsToRemove.length;
                    }
                }
            }

            return {
                status: 200,
                message: 'Old overtime data cleaned up for all mechanics',
                data: {
                    monthlyRecordsRemoved: totalCleanedRecords
                }
            };
        } catch (error) {
            throw {
                status: 500,
                message: error.message || 'Error cleaning up old overtime data'
            };
        }
    }

    /**
     * Migrate existing overtime data to monthly structure
     * This is no longer needed as we're only using the monthly structure
     * But keeping as a stub for backward compatibility
     */
    async migrateOvertimeDataToMonthlyStructure() {
        return {
            status: 200,
            message: 'No migration needed - system is already using monthly structure',
            data: {}
        };
    }
}

module.exports = new MechanicService();