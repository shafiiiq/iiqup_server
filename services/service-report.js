const serviceHistoryModel = require('../models/service-history.model.js');
const serviceReportModel = require('../models/service-report.model.js');
const { createNotification } = require('../utils/notification-jobs'); // Import notification service
const PushNotificationService = require('../utils/push-notification-jobs');

module.exports = {

  insertServiceReport: (data) => {

    return new Promise(async (resolve, reject) => {
      try {
        if (!data || !data.regNo || !data.date) {
          throw new Error('Missing required data: regNo and date are required');
        }

        if (data.checklistItems && data.serviceType !== 'normal') {
          data.serviceType = 'oil';
        } else if (data.serviceType === 'normal') {
          data.serviceType = 'normal';

          try {
            const correspondingReport = await serviceHistoryModel.findOne({
              regNo: data.regNo,
              date: data.date
            });

            console.log("correspondingReport", correspondingReport);

            if (correspondingReport) {
              // Update the serviceType field directly
              correspondingReport.serviceType = data.serviceType;

              await correspondingReport.save();
            }
          } catch (error) {
            console.error('Error updating service report:', error);
          }
        }

        const result = await serviceReportModel.create(data);

        if (!result) {
          throw new Error(`Failed to create service report for regNo: ${data.regNo}`);
        }

        await createNotification({
          title: `${data.machine} - ${data.regNo} serviced`,
          description: `At ${data.location}\nServiced Hours: ${data.serviceHrs}\nNext Service: ${data.nextServiceHrs}\n${data.remarks}\nMechanics: ${data.mechanics}`,
          priority: "high",
          sourceId: 'from applications',
          recipient: JSON.parse(process.env.OFFICE_MAIN),
          time: new Date()
        });

        await PushNotificationService.sendGeneralNotification(
          JSON.parse(process.env.OFFICE_MAIN),
          `${data.machine} - ${data.regNo} serviced`, //title
          `At ${data.location}\nServiced Hours: ${data.serviceHrs}\nNext Service: ${data.nextServiceHrs}\n${data.remarks}\nMechanics: ${data.mechanics}`, //decription
          'high', //priority
          'normal' // type
        );

        resolve({
          status: 200,
          ok: true,
          message: 'Service report created successfully',
          data: result
        });

      } catch (err) {
        console.error('Error inserting service report:', err);

        reject({
          status: 500,
          ok: false,
          message: `Error creating service report: ${err.message}`,
          error: err.message
        });
      }
    });
  },

  fetchServiceReport: (paramRegNO, paramDate) => {
    // Convert the date format from DD-MM-YYYY to YYYY-MM-DD
    const dateParts = paramDate.split('-');
    const formattedDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;

    return new Promise(async (resolve, reject) => {
      try {
        const getReport = await serviceReportModel.find({
          regNo: paramRegNO,
          date: formattedDate
        });

        resolve({
          status: 200,
          ok: true,
          data: getReport
        });
      } catch (error) {
        reject({
          status: 500,
          ok: false,
          message: error.message || 'Error fetching Reports'
        });
      }
    });
  },

  fetchServiceReportWith: (id) => {
    return new Promise(async (resolve, reject) => {
      try {
        const getReport = await serviceReportModel.find({
          _id: id,
        });

        resolve({
          status: 200,
          ok: true,
          data: getReport
        });
      } catch (error) {
        reject({
          status: 500,
          ok: false,
          message: error.message || 'Error fetching Reports'
        });
      }
    });
  },

  updateServiceReportWith: (id, updateData) => {
    return new Promise(async (resolve, reject) => {
      try {
        // Find and update the service report
        const updatedServiceReport = await serviceReportModel.findByIdAndUpdate(
          id,
          {
            ...updateData,
            updatedAt: new Date()
          },
          {
            new: true, // Return updated document
            runValidators: true // Run schema validators
          }
        );

        if (!updatedServiceReport) {
          return reject({
            success: false,
            message: 'Service report not found',
            status: 404
          });
        }

        // Extract filter information from checklist items for service history
        const getFilterStatus = (checklistItems, itemIds, filterType) => {
          if (!checklistItems || checklistItems.length === 0) return 'Check';

          const relevantItems = checklistItems.filter(item => itemIds.includes(item.id));

          if (relevantItems.length === 0) return 'Check';

          // Check if description contains 'change' keyword
          const hasChangeInDescription = relevantItems.some(item =>
            item.description && item.description.toLowerCase().includes('change')
          );

          return hasChangeInDescription ? 'Change' : 'Check';
        };

        // Determine filter statuses based on checklist items
        const oilFilterStatus = getFilterStatus(updatedServiceReport.checklistItems, [1], 'oil');
        const fuelFilterStatus = getFilterStatus(updatedServiceReport.checklistItems, [2], 'fuel');
        const airFilterStatus = getFilterStatus(updatedServiceReport.checklistItems, [3], 'air');

        // Check if it's a full service based on checklist completion
        const checklistItems = updatedServiceReport.checklistItems || [];
        const totalItems = checklistItems.length;
        const completedItems = checklistItems.filter(item =>
          item.status === '✓' || item.status === '✗'
        ).length;

        // Prepare service history update data
        const serviceHistoryUpdate = {
          date: updatedServiceReport.date,
          oil: oilFilterStatus, // Assuming oil status follows oilFilter
          oilFilter: oilFilterStatus,
          fuelFilter: fuelFilterStatus,
          waterSeparator: 'Check', // Default value, adjust as needed
          airFilter: airFilterStatus,
          serviceHrs: parseInt(updatedServiceReport.serviceHrs) || 0,
          nextServiceHrs: parseInt(updatedServiceReport.nextServiceHrs) || 0,
        };

        // Update service history - find by regNo and date
        const updatedServiceHistory = await serviceHistoryModel.findOneAndUpdate(
          {
            regNo: parseInt(updatedServiceReport.regNo), // Convert to number as per schema
            date: updatedServiceReport.date
          },
          serviceHistoryUpdate,
          {
            new: true,
            upsert: true, // Create if doesn't exist
            runValidators: true
          }
        );

        // Prepare response
        const response = {
          status: 200,
          success: true,
          message: 'Service report and history updated successfully',
          data: {
            serviceReport: updatedServiceReport,
            serviceHistory: updatedServiceHistory
          }
        };

        resolve(response);

      } catch (error) {
        console.error('Error updating service report:', error);
        reject({
          success: false,
          message: 'Failed to update service report',
          error: error.message || error,
          status: 500
        });
      }
    });
  },

  deleteServiceReportWith: async (id) => {
    try {
      // First, find the service report to get regNo and date before deletion
      const serviceReportToDelete = await serviceReportModel.findById(id);

      if (!serviceReportToDelete) {
        throw {
          success: false,
          message: 'Service report not found',
          status: 404
        };
      }

      // Extract regNo and date for service history lookup
      const { regNo, date } = serviceReportToDelete;

      // Delete the service report
      const deletedServiceReport = await serviceReportModel.findByIdAndDelete(id);

      if (!deletedServiceReport) {
        throw {
          success: false,
          message: 'Failed to delete service report',
          status: 500
        };
      }

      // Find and delete corresponding service history record
      const deletedServiceHistory = await serviceHistoryModel.findOneAndDelete({
        regNo: parseInt(regNo),
        date: date
      });

      const response = {
        success: true,
        message: 'Service report and corresponding service history deleted successfully',
        data: {
          deletedServiceReport: {
            id: deletedServiceReport._id,
            regNo: deletedServiceReport.regNo,
            date: deletedServiceReport.date,
            machine: deletedServiceReport.machine
          },
          deletedServiceHistory: deletedServiceHistory ? {
            id: deletedServiceHistory._id,
            regNo: deletedServiceHistory.regNo,
            date: deletedServiceHistory.date
          } : null
        }
      };
      return response;

    } catch (error) {
      console.error('Error deleting service report:', error);
      throw {
        success: false,
        message: 'Failed to delete service report',
        error: error.message || error,
        status: error.status || 500
      };
    }
  },

  fetchAllServiceHistories: (regNo) => {
    return new Promise(async (resolve, reject) => {
      try {
        const getReport = await serviceReportModel.find({
          regNo: regNo,
        }).sort({ date: -1 }); // Sort by date descending (newest first)

        resolve({
          status: 200,
          ok: true,
          data: getReport
        });
      } catch (error) {
        console.error('Error in fetchAllServiceHistories:', error);
        reject({
          status: 500,
          ok: false,
          message: error.message || 'Error fetching all service histories'
        });
      }
    });
  },

  fetchServicesByType: (regNo, serviceType) => {
    return new Promise(async (resolve, reject) => {
      try {
        const getReport = await serviceReportModel.find({
          regNo: regNo,
          serviceType: serviceType
        }).sort({ date: -1 }); // Sort by date descending (newest first)

        resolve({
          status: 200,
          ok: true,
          data: getReport
        });
      } catch (error) {
        console.error(`Error in fetchServicesByType (${serviceType}):`, error);
        reject({
          status: 500,
          ok: false,
          message: error.message || `Error fetching ${serviceType} services`
        });
      }
    });
  },

  fetchServicesByPeriod: (period) => {
    return new Promise(async (resolve, reject) => {
      try {
        const currentDate = new Date();
        let startDate;
        let endDate = new Date(currentDate);

        const formatDate = (date) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };

        switch (period) {
          case 'daily':
            startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
            endDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
            break;

          case 'yesterday':
            const yesterday = new Date(currentDate);
            yesterday.setDate(yesterday.getDate() - 1);
            startDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
            endDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
            break;

          case 'weekly':
            startDate = new Date(currentDate);
            startDate.setDate(startDate.getDate() - 7);
            break;

          case 'monthly':
            startDate = new Date(currentDate);
            startDate.setDate(startDate.getDate() - 30);
            break;

          case 'yearly':
            startDate = new Date(currentDate);
            startDate.setDate(startDate.getDate() - 365);
            break;

          default:
            throw new Error('Invalid period specified');
        }

        const formattedStartDate = formatDate(startDate);
        const formattedEndDate = formatDate(endDate);

        console.log('Period:', period);
        console.log('Start Date:', formattedStartDate);
        console.log('End Date:', formattedEndDate);

        const getReport = await serviceReportModel.find({
          date: {
            $gte: formattedStartDate,
            $lte: formattedEndDate
          }
        }).sort({ date: -1, regNo: 1 });

        console.log('Found reports:', getReport.length);
        console.log('Sample dates from DB:', getReport.slice(0, 3).map(r => r.date));

        const groupedByType = {
          oil: [],
          maintenance: [],
          tyre: [],
          battery: [],
          normal: [],
          other: []
        };

        const groupedByRegNo = {};

        getReport.forEach(report => {
          const type = report.serviceType || 'other';
          if (groupedByType[type]) {
            groupedByType[type].push(report);
          } else {
            groupedByType.other.push(report);
          }

          if (!groupedByRegNo[report.regNo]) {
            groupedByRegNo[report.regNo] = [];
          }
          groupedByRegNo[report.regNo].push(report);
        });

        const statistics = {
          total: getReport.length,
          totalEquipment: Object.keys(groupedByRegNo).length,
          byType: {
            oil: groupedByType.oil.length,
            maintenance: groupedByType.maintenance.length,
            tyre: groupedByType.tyre.length,
            battery: groupedByType.battery.length,
            normal: groupedByType.normal.length,
            other: groupedByType.other.length
          },
          byEquipment: Object.keys(groupedByRegNo).map(regNo => ({
            regNo: regNo,
            count: groupedByRegNo[regNo].length
          }))
        };

        resolve({
          status: 200,
          ok: true,
          period: period,
          dateRange: {
            from: formattedStartDate,
            to: formattedEndDate
          },
          statistics: statistics,
          data: {
            all: getReport,
            groupedByType: groupedByType,
            groupedByRegNo: groupedByRegNo
          }
        });
      } catch (error) {
        console.error(`Error in fetchServicesByPeriod (${period}):`, error);
        reject({
          status: 500,
          ok: false,
          message: error.message || `Error fetching ${period} services`
        });
      }
    });
  },

  fetchServicesByDateRange: (regNo, startDate, endDate) => {
    return new Promise(async (resolve, reject) => {
      try {
        // Convert date format from DD-MM-YYYY to YYYY-MM-DD for comparison
        const convertDate = (dateStr) => {
          const parts = dateStr.split('-');
          return `${parts[2]}-${parts[1]}-${parts[0]}`;
        };

        const formattedStartDate = convertDate(startDate);
        const formattedEndDate = convertDate(endDate);

        const getReport = await serviceReportModel.find({
          regNo: regNo,
          date: {
            $gte: formattedStartDate,
            $lte: formattedEndDate
          }
        }).sort({ date: -1 });

        resolve({
          status: 200,
          ok: true,
          data: getReport
        });
      } catch (error) {
        console.error('Error in fetchServicesByDateRange:', error);
        reject({
          status: 500,
          ok: false,
          message: error.message || 'Error fetching services by date range'
        });
      }
    });
  },

  fetchServicesByLastMonths: (regNo, monthsCount) => {
    return new Promise(async (resolve, reject) => {
      try {
        // Calculate the start date (X months ago)
        const currentDate = new Date();
        const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - monthsCount, 1);

        // Format dates to YYYY-MM-DD
        const formatDate = (date) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };

        const formattedStartDate = formatDate(startDate);
        const formattedCurrentDate = formatDate(currentDate);

        const getReport = await serviceReportModel.find({
          regNo: regNo,
          date: {
            $gte: formattedStartDate,
            $lte: formattedCurrentDate
          }
        }).sort({ date: -1 });

        resolve({
          status: 200,
          ok: true,
          data: getReport
        });
      } catch (error) {
        console.error('Error in fetchServicesByLastMonths:', error);
        reject({
          status: 500,
          ok: false,
          message: error.message || 'Error fetching services by last months'
        });
      }
    });
  },

  updateServiceReport: (id, updateData) => {
    return new Promise(async (resolve, reject) => {
      try {
        const validUser = await serviceReportModel.findById(id);
        if (validUser) {
          const updatedUser = await serviceReportModel.findByIdAndUpdate(id, updateData, { new: true });
          return resolve({
            status: 200,
            ok: true,
            message: 'Service report updated successfully',
            data: updatedUser
          });
        } else {
          reject({
            status: 404,
            ok: false,
            message: 'Service report not found'
          });
        }
      } catch (error) {
        reject({
          status: 500,
          ok: false,
          message: 'Unable to update service report'
        });
      }
    });
  },

  deleteServiceReport: (id) => {
    return new Promise(async (resolve, reject) => {
      try {
        const validUser = await serviceReportModel.findById(id);
        if (validUser) {
          const deleteUser = await serviceReportModel.findByIdAndDelete(id);
          return resolve({
            status: 200,
            ok: true,
            message: 'Service report deleted successfully',
            data: deleteUser
          });
        } else {
          reject({
            status: 404,
            ok: false,
            message: 'Service report not found'
          });
        }
      } catch (error) {
        reject({
          status: 500,
          ok: false,
          message: 'Unable to delete service report'
        });
      }
    });
  }
}