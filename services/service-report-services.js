const serviceHistoryModel = require('../models/service-history.model.js');
const tyreHistoryModel = require('../models/tyre.model.js');
const batteryHistoryModel = require('../models/batery.model.js');
const maintanceHistoryModel = require('../models/maintenance-history.model.js');
const serviceReportModel = require('../models/service-report.model.js');
const { createNotification } = require('../utils/notification-jobs.js'); // Import notification service
const PushNotificationService = require('../utils/push-notification-jobs.js');

module.exports = {

  insertServiceReport: (data) => {
    return new Promise(async (resolve, reject) => {
      try {
        if (!data || !data.regNo || !data.date) {
          throw new Error('Missing required data: regNo and date are required');
        }

        // Determine which history model to use based on serviceType
        let HistoryModel;
        if (data.serviceType === "oil" || data.serviceType === "normal") {
          HistoryModel = serviceHistoryModel;
        } else if (data.serviceType === "tyre") {
          HistoryModel = tyreHistoryModel;
        } else if (data.serviceType === "battery") {
          HistoryModel = batteryHistoryModel;
        } else if (data.serviceType === "maintenance") {
          HistoryModel = maintanceHistoryModel;
        } else {
          HistoryModel = serviceHistoryModel; // default
        }

        let correspondingHistory;

        // If historyId is provided, use it directly
        if (data.historyId) {
          correspondingHistory = await HistoryModel.findById(data.historyId);
        } else {
          // Fallback to finding by regNo and date
          correspondingHistory = await HistoryModel.findOne({
            regNo: data.regNo,
            date: data.date
          });
        }

        if (!correspondingHistory) {
          throw new Error(`No history record found for ${data.historyId ? 'historyId: ' + data.historyId : 'regNo: ' + data.regNo + ' and date: ' + data.date}`);
        }

        // Create the service report with historyId
        const reportData = {
          ...data,
          historyId: correspondingHistory._id.toString()
        };

        const result = await serviceReportModel.create(reportData);

        if (!result) {
          throw new Error(`Failed to create service report for regNo: ${data.regNo}`);
        }

        // Update the history record with reportId and serviceType
        correspondingHistory.reportId = result._id.toString();
        correspondingHistory.serviceType = data.serviceType;
        await correspondingHistory.save();

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
          `At ${data.location}\nServiced Hours: ${data.serviceHrs}\nNext Service: ${data.nextServiceHrs}\n${data.remarks}\nMechanics: ${data.mechanics}`, //description
          'high', //priority
          'normal' // type
        );

        resolve({
          status: 200,
          ok: true,
          message: 'Service report created successfully',
          data: {
            serviceReport: result
          }
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
    console.log("id ...................", id);

    return new Promise(async (resolve, reject) => {
      try {
        const getReport = await serviceReportModel.findById(id);

        if (!getReport) {
          return reject({
            status: 404,
            ok: false,
            message: 'Service report not found'
          });
        }

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
          oil: oilFilterStatus,
          oilFilter: oilFilterStatus,
          fuelFilter: fuelFilterStatus,
          waterSeparator: 'Check',
          airFilter: airFilterStatus,
          serviceHrs: parseInt(updatedServiceReport.serviceHrs) || 0,
          nextServiceHrs: parseInt(updatedServiceReport.nextServiceHrs) || 0,
        };

        let HistoryModel
        if (updatedServiceReport.serviceType === "oil" || updatedServiceReport.serviceType === "normal") {
          HistoryModel = serviceHistoryModel
          console.log("1")
        } else if (updatedServiceReport.serviceType === "tyre") {
          console.log("2")
          HistoryModel = tyreHistoryModel
        } else if (updatedServiceReport.serviceType === "battery") {
          console.log("3")
          HistoryModel = batteryHistoryModel
        } else if (updatedServiceReport.serviceType === "maintenance") {
          console.log("4")
          HistoryModel = maintanceHistoryModel
        }

        // Use historyId to find and update the exact history record
        const updatedServiceHistory = await HistoryModel.findByIdAndUpdate(
          updatedServiceReport.historyId,  // Use the stored historyId
          serviceHistoryUpdate,
          {
            new: true,
            runValidators: true
          }
        );

        const oldUpdatedServiceHistory = await HistoryModel.findOneAndUpdate(
          { date: updatedServiceReport.date, regNo: updatedServiceReport.regNo },  // Use the stored historyId
          serviceHistoryUpdate,
          {
            new: true,
            runValidators: true
          }
        );

        if (!updatedServiceHistory || oldUpdatedServiceHistory) {
          console.warn('Service history not found for historyId:', updatedServiceReport.historyId);
        }

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
      // First, find the service report to get historyId and serviceType before deletion
      const serviceReportToDelete = await serviceReportModel.findById(id);

      if (!serviceReportToDelete) {
        throw {
          success: false,
          message: 'Service report not found',
          status: 404
        };
      }

      // Extract historyId and serviceType for history deletion
      const { historyId, serviceType } = serviceReportToDelete;

      // Delete the service report
      const deletedServiceReport = await serviceReportModel.findByIdAndDelete(id);

      if (!deletedServiceReport) {
        throw {
          success: false,
          message: 'Failed to delete service report',
          status: 500
        };
      }

      // Determine which history model to use based on serviceType
      let HistoryModel;
      if (serviceType === "oil" || serviceType === "normal") {
        HistoryModel = serviceHistoryModel;
      } else if (serviceType === "tyre") {
        HistoryModel = tyreHistoryModel;
      } else if (serviceType === "battery") {
        HistoryModel = batteryHistoryModel;
      } else if (serviceType === "maintenance") {
        HistoryModel = maintanceHistoryModel;
      } else {
        HistoryModel = serviceHistoryModel; // default
      }

      // Find and delete corresponding history record using historyId
      let deletedServiceHistory = null;
      if (historyId) {
        deletedServiceHistory = await HistoryModel.findByIdAndDelete(historyId);
      }

      const response = {
        success: true,
        message: 'Service report and corresponding service history deleted successfully',
        data: {
          deletedServiceReport: {
            id: deletedServiceReport._id,
            regNo: deletedServiceReport.regNo,
            date: deletedServiceReport.date,
            machine: deletedServiceReport.machine,
            serviceType: deletedServiceReport.serviceType
          },
          deletedServiceHistory: deletedServiceHistory ? {
            id: deletedServiceHistory._id,
            regNo: deletedServiceHistory.regNo,
            date: deletedServiceHistory.date,
            serviceType: deletedServiceHistory.serviceType
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

  fetchAllServicesByDateRange: (startDate, endDate) => {
    return new Promise(async (resolve, reject) => {
      try {
        // Convert date format from DD-MM-YYYY to YYYY-MM-DD
        const convertDate = (dateStr) => {
          const parts = dateStr.split('-');
          return `${parts[2]}-${parts[1]}-${parts[0]}`;
        };

        const formattedStartDate = convertDate(startDate);
        const formattedEndDate = convertDate(endDate);

        const getReport = await serviceReportModel.find({
          date: {
            $gte: formattedStartDate,
            $lte: formattedEndDate
          }
        }).sort({ date: -1, regNo: 1 });

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
          }
        };

        resolve({
          status: 200,
          ok: true,
          period: 'custom',
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
        console.error('Error in fetchServicesByDateRange:', error);
        reject({
          status: 500,
          ok: false,
          message: error.message || 'Error fetching services by date range'
        });
      }
    });
  },

  fetchAllServicesByLastMonths: (monthsCount) => {
    return new Promise(async (resolve, reject) => {
      try {
        const currentDate = new Date();
        const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - monthsCount, currentDate.getDate());

        const formatDate = (date) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };

        const formattedStartDate = formatDate(startDate);
        const formattedEndDate = formatDate(currentDate);

        const getReport = await serviceReportModel.find({
          date: {
            $gte: formattedStartDate,
            $lte: formattedEndDate
          }
        }).sort({ date: -1, regNo: 1 });

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
          }
        };

        resolve({
          status: 200,
          ok: true,
          period: `last-${monthsCount}-months`,
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
        console.error('Error in fetchServicesByLastMonths:', error);
        reject({
          status: 500,
          ok: false,
          message: error.message || 'Error fetching services by last months'
        });
      }
    });
  },
  fetchServicesByTypeAndDateRange: (regNo, serviceType, startDate, endDate) => {
    return new Promise(async (resolve, reject) => {
      try {
        const convertDate = (dateStr) => {
          const parts = dateStr.split('-');
          return `${parts[2]}-${parts[1]}-${parts[0]}`;
        };

        const formattedStartDate = convertDate(startDate);
        const formattedEndDate = convertDate(endDate);

        const query = {
          regNo: regNo,
          date: {
            $gte: formattedStartDate,
            $lte: formattedEndDate
          }
        };

        // Add serviceType filter if provided (null means all types)
        if (serviceType) {
          query.serviceType = serviceType;
        }

        const getReport = await serviceReportModel.find(query).sort({ date: -1 });

        resolve({
          status: 200,
          ok: true,
          data: getReport
        });
      } catch (error) {
        console.error('Error in fetchServicesByTypeAndDateRange:', error);
        reject({
          status: 500,
          ok: false,
          message: error.message || 'Error fetching services by type and date range'
        });
      }
    });
  },

  fetchServicesByTypeAndLastMonths: (regNo, serviceType, monthsCount) => {
    return new Promise(async (resolve, reject) => {
      try {
        const currentDate = new Date();
        const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - monthsCount, 1);

        const formatDate = (date) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };

        const formattedStartDate = formatDate(startDate);
        const formattedCurrentDate = formatDate(currentDate);

        const query = {
          regNo: regNo,
          date: {
            $gte: formattedStartDate,
            $lte: formattedCurrentDate
          }
        };

        // Add serviceType filter if provided (null means all types)
        if (serviceType) {
          query.serviceType = serviceType;
        }

        const getReport = await serviceReportModel.find(query).sort({ date: -1 });

        resolve({
          status: 200,
          ok: true,
          data: getReport
        });
      } catch (error) {
        console.error('Error in fetchServicesByTypeAndLastMonths:', error);
        reject({
          status: 500,
          ok: false,
          message: error.message || 'Error fetching services by type and last months'
        });
      }
    });
  } 
}