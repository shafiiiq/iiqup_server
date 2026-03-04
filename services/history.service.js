const serviceHistoryModel     = require('../models/history.model.js');
const NotificationModel       = require('../models/notification.model.js');
const serviceReportModel      = require('../models/report.model.js');
const maintananceHistoryModel = require('../models/maintenance.model.js');
const tyreHistoryModel        = require('../models/tyre.model.js');
const batteryHistoryModel     = require('../models/battery.model.js');
const EquipmentModel          = require('../models/equipment.model.js');
const { createNotification }  = require('./notification.service.js');
const PushNotificationService = require('../push/notification.push.js');
const { default: mongoose }   = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolves the correct history model for a given service type.
 * @param {string} type  'oil' | 'normal' | 'tyre' | 'battery' | 'maintenance'
 * @returns {object|null} Mongoose model or null if invalid.
 */
const resolveHistoryModel = (type) => {
  switch (type) {
    case 'oil':
    case 'normal':      return serviceHistoryModel;
    case 'tyre':        return tyreHistoryModel;
    case 'battery':     return batteryHistoryModel;
    case 'maintenance': return maintananceHistoryModel;
    default:            return null;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Service History
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inserts a new service history record.
 * @param {object} data
 * @returns {Promise<object>}
 */
const insertServiceHistory = async (data) => {
  try {
    const isConflict = await serviceHistoryModel.findOne({ regNo: data.regNo, date: data.date });
    if (isConflict) return { status: 408, ok: false, message: 'Data is already added', error: true };

    const fullService = await NotificationModel.findOne({ regNo: data.regNo });

    if (fullService && data.fullService === true) {
      const deleteResult = await NotificationModel.findOneAndDelete({ regNo: data.regNo });
      if (!deleteResult) console.warn('[ServiceHistoryService] insertServiceHistory — notification not deleted properly');
    }

    const serviceHistory = await serviceHistoryModel.create({
      regNo:          data.regNo,
      date:           data.date,
      oil:            data.oil,
      oilFilter:      data.oilFilter,
      fuelFilter:     data.fuelFilter,
      waterSeparator: data.waterSeparator,
      acFilter:       data.acFilter,
      airFilter:      data.airFilter,
      serviceHrs:     data.serviceHrs,
      nextServiceHrs: data.nextServiceHrs,
      fullService:    data.fullService
    });

    return { status: 200, ok: true, message: 'Service history added successfully', data: serviceHistory };
  } catch (error) {
    console.error('[ServiceHistoryService] insertServiceHistory:', error);
    return { status: 500, ok: false, message: 'Missing data or an error occurred', error: error.message };
  }
};

/**
 * Fetches all service history records for a registration number,
 * enriching full-service records with remarks from service reports.
 * @param {string} regNo
 * @returns {Promise<object>}
 */
const fetchServiceHistory = async (regNo) => {
  try {
    let serviceRecords = await serviceHistoryModel.find({ regNo });
    serviceRecords     = serviceRecords.map(r => r.toObject());

    for (const record of serviceRecords) {
      if (record.fullService !== true) continue;

      const serviceReports = await serviceReportModel.find({ regNo: record.regNo, date: record.date });
      if (serviceReports.length > 0) record.remarks = serviceReports[0].remarks;
    }

    return { status: 200, ok: true, data: serviceRecords };
  } catch (error) {
    console.error('[ServiceHistoryService] fetchServiceHistory:', error);
    return { status: 500, ok: false, message: error.message || 'Error fetching service history' };
  }
};

/**
 * Fetches a single service history record by ID and service type.
 * @param {string} id
 * @param {string} serviceType  'oil' | 'normal' | 'tyre' | 'battery' | 'maintenance'
 * @returns {Promise<object>}
 */
const fetchServiceHistoryById = async (id, serviceType) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return { status: 400, ok: false, message: 'Invalid service history ID' };
    }

    const HistoryModel = resolveHistoryModel(serviceType);
    if (!HistoryModel) return { status: 400, ok: false, message: 'Invalid service type' };

    const serviceRecord = await HistoryModel.findById(id);
    if (!serviceRecord) return { status: 404, ok: false, message: 'Service history not found' };

    return { status: 200, ok: true, data: serviceRecord };
  } catch (error) {
    console.error('[ServiceHistoryService] fetchServiceHistoryById:', error);
    return { status: 500, ok: false, message: error.message || 'Error fetching service history' };
  }
};

/**
 * Fetches the most recent full-service record for a registration number.
 * @param {string} regNo
 * @returns {Promise<object>}
 */
const fetchLatestFullService = async (regNo) => {
  try {
    const record = await serviceHistoryModel
      .find({ regNo, fullService: true })
      .sort({ date: -1 })
      .limit(1);

    return { status: 200, ok: true, data: record[0] || false };
  } catch (error) {
    console.error('[ServiceHistoryService] fetchLatestFullService:', error);
    return { status: 500, ok: false, message: error.message || 'Error fetching latest full service' };
  }
};

/**
 * Updates a service history record by ID.
 * @param {string} id
 * @param {object} updateData
 * @returns {Promise<object>}
 */
const updateServiceHistory = async (id, updateData) => {
  try {
    const existing = await serviceHistoryModel.findById(id);
    if (!existing) return { status: 404, ok: false, message: 'Service history not found' };

    const updated = await serviceHistoryModel.findByIdAndUpdate(id, updateData, { new: true });
    return { status: 200, ok: true, message: 'Service history updated successfully', data: updated };
  } catch (error) {
    console.error('[ServiceHistoryService] updateServiceHistory:', error);
    return { status: 500, ok: false, message: 'Unable to update service history' };
  }
};

/**
 * Deletes a service history record by ID and type, also removes its linked service report.
 * @param {string} id
 * @param {string} type  'oil' | 'normal' | 'tyre' | 'battery' | 'maintenance'
 * @returns {Promise<object>}
 */
const deleteServiceHistory = async (id, type) => {
  try {
    const HistoryModel = resolveHistoryModel(type) || serviceHistoryModel;

    const historyToDelete = await HistoryModel.findById(id);
    if (!historyToDelete) return { status: 404, ok: false, message: `Service history with ID ${id} not found` };

    const { reportId }     = historyToDelete;
    const deletedHistory   = await HistoryModel.findByIdAndDelete(id);
    if (!deletedHistory) return { status: 404, ok: false, message: `Service history with ID ${id} not found` };

    let deletedReport = null;
    if (reportId) {
      deletedReport = await serviceReportModel.findByIdAndDelete(reportId);
    }

    return {
      status:  200,
      ok:      true,
      message: 'Service history and associated report deleted successfully',
      data: {
        deletedHistory,
        deletedReport: deletedReport
          ? { id: deletedReport._id, regNo: deletedReport.regNo, date: deletedReport.date, machine: deletedReport.machine }
          : null
      }
    };
  } catch (error) {
    console.error('[ServiceHistoryService] deleteServiceHistory:', error);
    return { status: 500, ok: false, message: 'Failed to delete service history', error: error.message };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Maintenance History
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inserts a new maintenance history record.
 * @param {object} data
 * @returns {Promise<object>}
 */
const insertMaintananceHistory = async (data) => {
  try {
    const record = await maintananceHistoryModel.create({
      regNo:       data.regNo,
      date:        data.date,
      equipment:   data.equipment,
      workRemarks: data.workRemarks,
      mechanics:   data.mechanics
    });

    return { status: 200, ok: true, message: 'Maintenance history added successfully', data: record };
  } catch (error) {
    console.error('[ServiceHistoryService] insertMaintananceHistory:', error);
    return { status: 500, ok: false, message: 'Missing data or an error occurred', error: error.message };
  }
};

/**
 * Fetches all maintenance history records for a registration number.
 * @param {string} regNo
 * @returns {Promise<object>}
 */
const fetchMaintananceHistory = async (regNo) => {
  try {
    const records = await maintananceHistoryModel.find({ regNo });
    return { status: 200, ok: true, data: records };
  } catch (error) {
    console.error('[ServiceHistoryService] fetchMaintananceHistory:', error);
    return { status: 500, ok: false, message: error.message || 'Error fetching maintenance history' };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Tyre History
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inserts a new tyre history record.
 * @param {object} data
 * @returns {Promise<object>}
 */
const insertTyreHistory = async (data) => {
  try {
    const record = await tyreHistoryModel.create({
      date:         data.date,
      tyreModel:    data.tyreModel,
      tyreNumber:   data.tyreNumber,
      equipment:    data.equipment,
      equipmentNo:  data.equipmentNo,
      location:     data.location,
      operator:     data.operator,
      runningHours: data.runningHours
    });

    return { status: 200, ok: true, message: 'Tyre history added successfully', data: record };
  } catch (error) {
    console.error('[ServiceHistoryService] insertTyreHistory:', error);
    return { status: 500, ok: false, message: 'Missing data or an error occurred', error: error.message };
  }
};

/**
 * Fetches all tyre history records for an equipment number.
 * @param {string} equipmentNo
 * @returns {Promise<object>}
 */
const fetchTyreHistory = async (equipmentNo) => {
  try {
    const records = await tyreHistoryModel.find({ equipmentNo });
    return { status: 200, ok: true, data: records };
  } catch (error) {
    console.error('[ServiceHistoryService] fetchTyreHistory:', error);
    return { status: 500, ok: false, message: error.message || 'Error fetching tyre history' };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Battery History
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inserts a new battery history record.
 * @param {object} data
 * @returns {Promise<object>}
 */
const insertBatteryHistory = async (data) => {
  try {
    const record = await batteryHistoryModel.create({
      date:         data.date,
      batteryModel: data.batteryModel,
      equipment:    data.equipment,
      equipmentNo:  data.equipmentNo,
      location:     data.location,
      operator:     data.operator
    });

    return { status: 200, ok: true, message: 'Battery history added successfully', data: record };
  } catch (error) {
    console.error('[ServiceHistoryService] insertBatteryHistory:', error);
    return { status: 500, ok: false, message: 'Missing data or an error occurred', error: error.message };
  }
};

/**
 * Fetches all battery history records for an equipment number.
 * @param {string} equipmentNo
 * @returns {Promise<object>}
 */
const fetchBatteryHistory = async (equipmentNo) => {
  try {
    const records = await batteryHistoryModel.find({ equipmentNo });
    return { status: 200, ok: true, data: records };
  } catch (error) {
    console.error('[ServiceHistoryService] fetchBatteryHistory:', error);
    return { status: 500, ok: false, message: error.message || 'Error fetching battery history' };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a full-service due notification for an equipment.
 * @param {object} data  Must include regNo and nextServiceHrs.
 * @returns {Promise<object>}
 */
const insertFullService = async (data) => {
  try {
    if (!data?.regNo) return { status: 400, ok: false, message: 'Registration number is required' };

    const equipment    = await EquipmentModel.findOne({ regNo: data.regNo });
    const label        = `${equipment.brand} ${equipment.machine} ${data.regNo}`;
    const notifTitle   = `Time to full service - ${label}`;
    const notifMessage = `${label}'s next service is full service, NEXT SERVICE HR/KM: ${data.nextServiceHrs}`;

    const notification = await createNotification({
      title:       notifTitle,
      description: notifMessage,
      priority:    'high',
      sourceId:    'from applications',
      time:        new Date()
    });

    await PushNotificationService.sendGeneralNotification(
      null, notifTitle, notifMessage, 'high', 'normal', notification.data._id.toString()
    );

    return { status: 200, ok: true, message: 'Full service notification sent successfully' };
  } catch (error) {
    console.error('[ServiceHistoryService] insertFullService:', error);
    return { status: 500, ok: false, message: 'Missing data or an error occurred', error: error.message };
  }
};

/**
 * Fetches all full-service notifications.
 * @returns {Promise<object>}
 */
const fetchFullServiceNotification = async () => {
  try {
    const notifications = await NotificationModel.find({});
    return { status: 200, ok: true, data: notifications };
  } catch (error) {
    console.error('[ServiceHistoryService] fetchFullServiceNotification:', error);
    return { status: 500, ok: false, message: error.message || 'Error fetching full service notifications' };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  insertServiceHistory,
  fetchServiceHistory,
  fetchServiceHistoryById,
  fetchLatestFullService,
  updateServiceHistory,
  deleteServiceHistory,
  insertMaintananceHistory,
  fetchMaintananceHistory,
  insertTyreHistory,
  fetchTyreHistory,
  insertBatteryHistory,
  fetchBatteryHistory,
  insertFullService,
  fetchFullServiceNotification
};