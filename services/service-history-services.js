const { promises } = require('fs');
const serviceHistoryModel = require('../models/service-history.model.js');
const NotificationModel = require('../models/notification-model.js');
const serviceReportModel = require('../models/service-report.model.js');
const maintananceHistoryModel = require('../models/maintanance-history.model.js');
const tyreModel = require('../models/tyre.model.js');
const batteryModel = require('../models/batery.model.js');
const { createNotification } = require('../utils/notification-jobs'); // Import notification service
const PushNotificationService = require('../utils/push-notification-jobs');
const Equipment = require('../models/equip.model');

module.exports = {

    insertServiceHisory: (data) => {
        return new Promise(async (resolve, reject) => {
            try {
                const isConflict = await serviceHistoryModel.findOne({ regNo: data.regNo, date: data.date })

                if (isConflict) {
                    return reject({
                        status: 408,
                        ok: false,
                        message: 'Data is already addedd',
                        error: true
                    });
                }


                const fullService = await NotificationModel.findOne({ regNo: data.regNo });

                if (fullService && data.fullService === true) {
                    const deleteResult = NotificationModel.findOneAndDelete({ regNo: data.regNo });

                    if (deleteResult.deletedCount !== 1) {
                        console.warn("Warning: Document found but not deleted properly");
                    }
                }

                const serviceHistory = await serviceHistoryModel.create({
                    regNo: data.regNo,
                    date: data.date,
                    oil: data.oil,
                    oilFilter: data.oilFilter,
                    fuelFilter: data.fuelFilter,
                    waterSeparator: data.waterSeparator,
                    acFilter: data.acFilter,
                    airFilter: data.airFilter,
                    serviceHrs: data.serviceHrs,
                    nextServiceHrs: data.nextServiceHrs,
                    fullService: data.fullService
                });

                resolve({
                    status: 200,
                    ok: true,
                    message: 'Service History added successfully',
                    data: serviceHistory
                });

            } catch (err) {
                console.error("Error occurred:", err);
                reject({
                    status: 500,
                    ok: false,
                    message: 'Missing data or an error occurred',
                    error: err.message
                });
            }
        });
    },


    insertMaintananceHisory: (data) => {
        return new Promise(async (resolve, reject) => {
            try {
                const serviceHistory = await maintananceHistoryModel.create({
                    regNo: data.regNo,
                    date: data.date,
                    equipment: data.equipment,
                    workRemarks: data.workRemarks,
                    mechanics: data.mechanics
                });

                resolve({
                    status: 200,
                    ok: true,
                    message: 'Service History added successfully',
                    data: serviceHistory
                });

            } catch (err) {
                console.error("Error occurred:", err);
                reject({
                    status: 500,
                    ok: false,
                    message: 'Missing data or an error occurred',
                    error: err.message
                });
            }
        });
    },

    // fetchServiceHistory: (data) => {
    //     return new Promise(async (resolve, reject) => {
    //         try {
    //             const getusers = await serviceHistoryModel.find({ regNo: data });
    //             resolve({
    //                 status: 200,
    //                 ok: true,
    //                 data: getusers
    //             });
    //         } catch (error) {
    //             reject({
    //                 status: 500,
    //                 ok: false,
    //                 message: error.message || 'Error fetching users'
    //             });
    //         }
    //     });
    // },

    fetchMaintananceHistory: (data) => {
        return new Promise(async (resolve, reject) => {
            try {
                const getusers = await maintananceHistoryModel.find({ regNo: data });

                resolve({
                    status: 200,
                    ok: true,
                    data: getusers
                });
            } catch (error) {
                reject({
                    status: 500,
                    ok: false,
                    message: error.message || 'Error fetching users'
                });
            }
        });
    },

    fetchServiceHistory: (data) => {
        return new Promise(async (resolve, reject) => {
            try {
                // First, fetch the service history records
                let serviceRecords = await serviceHistoryModel.find({ regNo: data });

                // Convert Mongoose documents to plain JavaScript objects
                serviceRecords = serviceRecords.map(record => record.toObject());

                for (let i = 0; i < serviceRecords.length; i++) {
                    if (serviceRecords[i].fullService === true) {

                        const serviceReports = await serviceReportModel.find({
                            regNo: serviceRecords[i].regNo,
                            date: serviceRecords[i].date
                        });



                        if (serviceReports && serviceReports.length > 0) {
                            // Use serviceReports[0] instead of serviceReport[i]
                            serviceRecords[i].remarks = serviceReports[0].remarks;
                        }
                    }
                }

                resolve({
                    status: 200,
                    ok: true,
                    data: serviceRecords
                });
            } catch (error) {
                reject({
                    status: 500,
                    ok: false,
                    message: error.message || 'Error fetching service history'
                });
            }
        });
    },

    insertFullService: (data) => {
        return new Promise(async (resolve, reject) => {
            try {
                // Check if data is provided
                if (!data || !data.regNo) {
                    return reject({
                        status: 400,
                        ok: false,
                        message: 'Registration number is required'
                    });
                }

                const equipment = await Equipment.findOne({ regNo: data.regNo });

                await createNotification({
                    title: `Time to full service - ${equipment.brand} ${equipment.machine} ${data.regNo}`,
                    description: `${equipment.brand} ${equipment.machine} ${data.regNo}'s next service is full service`,
                    priority: "high",
                    sourceId: 'from applications',
                    time: new Date()
                });

                await PushNotificationService.sendGeneralNotification(
                    null,
                    `Time to full service - ${equipment.brand} ${equipment.machine} ${data.regNo}`,
                    `${equipment.brand} ${equipment.machine} ${data.regNo}'s next service is full service`,
                    'high',
                    'normal'
                );

                resolve({
                    status: 200,
                    ok: true,
                    message: 'Full Service History added successfully',
                });

            } catch (err) {
                console.error("Error occurred:", err);
                reject({
                    status: 500,
                    ok: false,
                    message: 'Missing data or an error occurred',
                    error: err.message
                });
            }
        });
    },

    fetchLatestFullService: (data) => {
        return new Promise(async (resolve, reject) => {
            try {
                // Find all documents matching regNo and fullService:true, sort by date in descending order, limit to 1
                const getLatestFullService = await serviceHistoryModel.find(
                    { regNo: data, fullService: true }
                ).sort({ date: -1 }).limit(1);

                resolve({
                    status: 200,
                    ok: true,
                    data: getLatestFullService[0] || false // Return the first item or null if no results
                });
            } catch (error) {
                reject({
                    status: 500,
                    ok: false,
                    message: error.message || 'Error fetching latest full service'
                });
            }
        });
    },

    updateServiceHistory: (id, updateData) => {
        return new Promise(async (resolve, reject) => {
            try {
                const validUser = await serviceHistoryModel.findById(id);
                if (validUser) {
                    const updatedUser = await serviceHistoryModel.findByIdAndUpdate(id, updateData);
                    return resolve({
                        status: 200,
                        ok: true,
                        message: 'User updated successfully',
                        data: updatedUser
                    });
                }
            } catch (error) {
                reject({
                    status: 500,
                    ok: false,
                    message: 'unable to update user'
                });
            }
        });
    },
    deleteServiceHistory: (id) => {
        return new Promise(async (resolve, reject) => {
            try {
                const validUser = await serviceHistoryModel.findById(id);
                if (validUser) {
                    const deleteUser = await serviceHistoryModel.findByIdAndDelete(id);
                    return resolve({
                        status: 200,
                        ok: true,
                        message: 'User deleted successfully',
                        data: deleteUser
                    });
                }
            } catch (error) {
                reject({
                    status: 500,
                    ok: false,
                    message: 'unable to delete user'
                });
            }
        });
    },

    fetchFullServiceNotification: (data) => {
        return new Promise(async (resolve, reject) => {
            try {
                const fullServiceNotification = await NotificationModel.find({})
                resolve({
                    status: 200,
                    ok: true,
                    data: fullServiceNotification
                });
            } catch (error) {
                reject({
                    status: 500,
                    ok: false,
                    message: error.message || 'Error fetching latest full service'
                });
            }
        });
    },

    insertTyreHisory: (data) => {
        return new Promise(async (resolve, reject) => {
            try {

                const serviceHistory = await tyreModel.create({
                    date: data.date,
                    tyreModel: data.tyreModel,
                    tyreNumber: data.tyreNumber,
                    equipment: data.equipment,
                    equipmentNo: data.equipmentNo,
                    location: data.location,
                    operator: data.operator,
                    runningHours: data.runningHours,
                });

                resolve({
                    status: 200,
                    ok: true,
                    message: 'Service History added successfully',
                    data: serviceHistory
                });

            } catch (err) {
                console.error("Error occurred:", err);
                reject({
                    status: 500,
                    ok: false,
                    message: 'Missing data or an error occurred',
                    error: err.message
                });
            }
        });
    },

    fetchTyreHistory: (data) => {
        return new Promise(async (resolve, reject) => {
            try {
                const getusers = await tyreModel.find({ equipmentNo: data });
                resolve({
                    status: 200,
                    ok: true,
                    data: getusers
                });
            } catch (error) {
                reject({
                    status: 500,
                    ok: false,
                    message: error.message || 'Error fetching users'
                });
            }
        });
    },

    insertBatteryHistory: (data) => {
        return new Promise(async (resolve, reject) => {
            try {
                const serviceHistory = await batteryModel.create({
                    date: data.date,
                    batteryModel: data.batteryModel,
                    equipment: data.equipment,
                    equipmentNo: data.equipmentNo,
                    location: data.location,
                    operator: data.operator,
                });

                resolve({
                    status: 200,
                    ok: true,
                    message: 'Service History added successfully',
                    data: serviceHistory
                });

            } catch (err) {
                console.error("Error occurred:", err);
                reject({
                    status: 500,
                    ok: false,
                    message: 'Missing data or an error occurred',
                    error: err.message
                });
            }
        });
    },

    fetchBatteryHistory: (data) => {
        return new Promise(async (resolve, reject) => {
            try {
                const getusers = await batteryModel.find({ equipmentNo: data });
                resolve({
                    status: 200,
                    ok: true,
                    data: getusers
                });
            } catch (error) {
                reject({
                    status: 500,
                    ok: false,
                    message: error.message || 'Error fetching users'
                });
            }
        });
    },

    deleteServiceHistory: async (id, type) => {
        try {

            let deletedToolkit
            if (type == 'oil') {
                deletedToolkit = await serviceHistoryModel.findByIdAndDelete(id)
            } else if (type == 'tyre') {
                deletedToolkit = await tyreModel.findByIdAndDelete(id)
            } else if (type == 'battery') {
                deletedToolkit = await batteryModel.findByIdAndDelete(id)
            } else {
                deletedToolkit = await maintananceHistoryModel.findByIdAndDelete(id)
            }

            if (!deletedToolkit) {
                return {
                    status: 404,
                    success: false,
                    message: `Service with ID ${id} not found`
                };
            }

            return {
                status: 200,
                success: true,
                message: 'Service deleted successfully',
                data: deletedToolkit
            };
        } catch (error) {
            return {
                status: 400,
                success: false,
                message: 'Failed to delete Service',
                error: error.message
            };
        }
    }

}