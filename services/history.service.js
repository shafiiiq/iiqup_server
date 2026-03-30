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
const { default: wsUtils } = require('../sockets/websocket.js');
const analyser = require('../analyser/dashboard.analyser');

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

 
/**
 * Resolves the correct history model for a given service type.
 * @param {string} type  'oil'|'normal'|'tyre'|'battery'|'maintenance'
 * @returns {Model}
 */
const resolveModel = (type) => {
  switch (type) {
    case 'tyre':        return tyreHistoryModel;
    case 'battery':     return batteryHistoryModel;
    case 'maintenance': return maintananceHistoryModel;
    default:            return serviceHistoryModel; // oil | normal
  }
};
 
/**
 * Derives the checklist status strings that the single-record flow writes into
 * the history document for oil/normal services, mirroring applyOilServiceChecklist
 * on the frontend.
 *
 * @param {Object} shared  sharedData from the request body
 * @returns {{ oil, oilFilter, fuelFilter, acFilter, waterSeparator, airFilter }}
 */
const deriveOilFlags = (shared) => ({
  oil:            shared.oil            || 'Check',
  oilFilter:      shared.oilFilter      || 'Check',
  fuelFilter:     shared.fuelFilter     || 'Check',
  acFilter:       shared.acFilter       || 'Clean',
  waterSeparator: shared.waterSeparator || 'Check',
  airFilter:      shared.airFilter      || 'Clean',
});
 
/**
 * Checks whether the next service crosses a 3 000 hr/km full-service boundary
 * and, if so, creates the notification — exactly as the single-record flow does.
 *
 * @param {string} regNo
 * @param {string} serviceHrs
 * @param {string} nextServiceHrs
 */
const maybeFireFullServiceNotification = async (regNo, serviceHrs, nextServiceHrs) => {
  if (!serviceHrs || !nextServiceHrs) return;
 
  const current = parseInt(String(serviceHrs).replace(/[^0-9]/g, ''), 10);
  const next    = parseInt(String(nextServiceHrs).replace(/[^0-9]/g, ''), 10);
 
  if (isNaN(current) || isNaN(next)) return;
  if (Math.floor(next / 3000) <= Math.floor(current / 3000)) return;
 
  // Boundary crossed — build and send notification.
  const equipment  = await EquipmentModel.findOne({ regNo });
  const label      = equipment ? `${equipment.brand} ${equipment.machine} ${regNo}` : `${regNo}`;
  const notifTitle = `Time to full service - ${label}`;
  const notifMsg   = `${label}'s next service is full service, NEXT SERVICE HR/KM: ${nextServiceHrs}`;
 
  const notification = await createNotification({
    title:       notifTitle,
    description: notifMsg,
    priority:    'high',
    sourceId:    'from applications',
    time:        new Date(),
  });
 
  await PushNotificationService.sendGeneralNotification(
    null, notifTitle, notifMsg, 'high', 'normal',
    notification.data._id.toString()
  );
};
 
// ─────────────────────────────────────────────────────────────────────────────
// Per-type history builders
// ─────────────────────────────────────────────────────────────────────────────
 
/**
 * Builds the history document data for oil / normal service records.
 * @param {Object} record   Single entry from records[].
 * @param {Object} shared   sharedData from the request body.
 * @returns {Object}
 */
const buildOilHistoryData = (record, shared) => {
  const flags = deriveOilFlags(shared);
  return {
    regNo:          shared.regNo,
    date:           record.date,
    serviceHrs:     record.serviceHrs,
    nextServiceHrs: record.nextServiceHrs,
    fullService:    record.fullService || false,
    ...flags,
  };
};
 
/**
 * Builds the history document data for tyre records.
 */
const buildTyreHistoryData = (record, shared) => ({
  date:         record.date,
  tyreModel:    shared.tyreModel    || record.tyreModel,
  tyreNumber:   shared.tyreNumber   || record.tyreNumber,
  equipment:    shared.machine,
  equipmentNo:  shared.regNo,
  location:     shared.location,
  operator:     shared.operator,
  runningHours: record.runningHours || record.serviceHrs,
});
 
/**
 * Builds the history document data for battery records.
 */
const buildBatteryHistoryData = (record, shared) => ({
  date:         record.date,
  batteryModel: shared.batteryModel || record.batteryModel,
  equipment:    shared.machine,
  equipmentNo:  shared.regNo,
  location:     shared.location,
  operator:     shared.operator,
});
 
/**
 * Builds the history document data for maintenance records.
 */
const buildMaintenanceHistoryData = (record, shared) => ({
  regNo:       shared.regNo,
  date:        record.date,
  equipment:   shared.machine,
  workRemarks: shared.remarks || record.workRemarks || '',
  mechanics:   shared.mechanics,
});
 
/**
 * Dispatches to the correct history data builder for the given type.
 * @param {string} type
 * @param {Object} record
 * @param {Object} shared
 * @returns {Object}
 */
const buildHistoryData = (type, record, shared) => {
  switch (type) {
    case 'tyre':        return buildTyreHistoryData(record, shared);
    case 'battery':     return buildBatteryHistoryData(record, shared);
    case 'maintenance': return buildMaintenanceHistoryData(record, shared);
    default:            return buildOilHistoryData(record, shared); // oil | normal
  }
};
 
// ─────────────────────────────────────────────────────────────────────────────
// Report builder
// ─────────────────────────────────────────────────────────────────────────────
 
/**
 * Builds the service report document data from shared + per-record fields.
 * The historyId is injected after the history document has been saved.
 *
 * @param {string} type
 * @param {Object} record
 * @param {Object} shared
 * @param {string} historyId
 * @returns {Object}
 */
const buildReportData = (type, record, shared, historyId) => ({
  regNo:          String(shared.regNo),
  machine:        shared.machine        || '',
  date:           record.date,
  serviceHrs:     record.serviceHrs     || record.runningHours || '',
  nextServiceHrs: record.nextServiceHrs || '',
  serviceType:    type,
  location:       shared.location       || '',
  mechanics:      shared.mechanics      || '',
  operatorName:   shared.operator       || shared.operatorName || '',
  remarks:        shared.remarks        || record.remarks      || '',
  checklistItems: shared.checklistItems || [],
  historyId,
});
 
// ─────────────────────────────────────────────────────────────────────────────
// Per-record processor
// ─────────────────────────────────────────────────────────────────────────────
 
/**
 * Processes one record from the batch:
 *   1. Duplicate-check (oil/normal only, same as single-record flow).
 *   2. Create history document.
 *   3. Create report document.
 *   4. Cross-link both documents.
 *   5. Fire full-service notification if threshold crossed (oil/normal only).
 *
 * @param {string} type     Service type.
 * @param {Object} record   Single entry from records[].
 * @param {Object} shared   Shared fields across the whole batch.
 * @returns {Promise<{ ok: true, history, report } | { ok: false, reason: string }>}
 */
const processRecord = async (type, record, shared) => {
  const HistoryModel = resolveModel(type);
  const isOilNormal  = type === 'oil' || type === 'normal';
 
  // ── 1. Duplicate check (oil / normal only) ─────────────────────────────────
  if (isOilNormal) {
    const conflict = await serviceHistoryModel.findOne({
      regNo: shared.regNo,
      date:  record.date,
    });
    if (conflict) {
      return { ok: false, reason: `Duplicate — a record for ${shared.regNo} on ${record.date} already exists` };
    }
  }
 
  // ── 2. Create history ──────────────────────────────────────────────────────
  const historyData = buildHistoryData(type, record, shared);
  const history     = await HistoryModel.create(historyData);
 
  // ── 3. Create report ───────────────────────────────────────────────────────
  const reportData = buildReportData(type, record, shared, history._id.toString());
  const report     = await serviceReportModel.create(reportData);
 
  // ── 4. Cross-link ──────────────────────────────────────────────────────────
  history.reportId    = report._id.toString();
  history.serviceType = type;
  await history.save();
 
  // ── 5. Full-service notification (oil / normal only) ──────────────────────
  if (isOilNormal) {
    await maybeFireFullServiceNotification(
      shared.regNo,
      record.serviceHrs,
      record.nextServiceHrs
    ).catch((err) =>
      // Non-fatal — log but don't fail the record.
      console.warn('[BatchService] notification error:', err.message)
    );
  }
 
  return { ok: true, history, report };
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

    analyser.clearCache();
    wsUtils.sendDashboardUpdate('serviceHistory', 'maintenanceHistory', 'tyreHistory', 'batteryHistory');
    
    return { status: 200, ok: true, message: 'Service history added successfully', data: serviceHistory };
  } catch (error) {
    console.error('[ServiceHistoryService] insertServiceHistory:', error);
    return { status: 500, ok: false, message: 'Missing data or an error occurred', error: error.message };
  }
};

/**
 * Bulk-inserts service history + report pairs for all records in the batch.
 *
 * Expected body shape:
 * {
 *   type:        'oil' | 'normal' | 'tyre' | 'battery' | 'maintenance',
 *   sharedData:  {
 *     regNo, machine, location, mechanics, operator, operatorName, remarks,
 *     checklistItems,
 *     // oil/normal extras:
 *     oil, oilFilter, fuelFilter, acFilter, waterSeparator, airFilter,
 *     // tyre extras:  tyreModel, tyreNumber
 *     // battery extras: batteryModel
 *   },
 *   records: [
 *     // oil/normal:   { date, serviceHrs, nextServiceHrs, fullService? }
 *     // tyre:         { date, runningHours }
 *     // battery:      { date }
 *     // maintenance:  { date, workRemarks? }
 *   ]
 * }
 *
 * @param {Object} body  Parsed request body.
 * @returns {Promise<Object>}
 */
const insertBatchServiceHistory = async (body) => {
  const { type, sharedData, records } = body;
 
  // ── Input guards ───────────────────────────────────────────────────────────
  if (!type)                        return { status: 400, ok: false, message: 'type is required' };
  if (!sharedData?.regNo)           return { status: 400, ok: false, message: 'sharedData.regNo is required' };
  if (!sharedData?.machine)         return { status: 400, ok: false, message: 'sharedData.machine is required' };
  if (!Array.isArray(records) || !records.length)
    return { status: 400, ok: false, message: 'records array is required and must not be empty' };
 
  const validTypes = ['oil', 'normal', 'tyre', 'battery', 'maintenance'];
  if (!validTypes.includes(type))   return { status: 400, ok: false, message: `Invalid type. Must be one of: ${validTypes.join(', ')}` };
 
  // ── Process each record independently ─────────────────────────────────────
  const succeeded = [];
  const failed    = [];
 
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
 
    if (!record.date) {
      failed.push({ index: i, record, reason: 'date is required for every record' });
      continue;
    }
 
    try {
      const result = await processRecord(type, record, sharedData);
 
      if (result.ok) {
        succeeded.push({
          index:   i,
          date:    record.date,
          history: result.history,
          report:  result.report,
        });
      } else {
        failed.push({ index: i, record, reason: result.reason });
      }
    } catch (err) {
      console.error(`[BatchService] record ${i} (${record.date}) failed:`, err);
      failed.push({ index: i, record, reason: err.message || 'Unexpected error' });
    }
  }
 
  // ── Invalidate caches / push WS update once for the whole batch ───────────
  if (succeeded.length > 0) {
    analyser.clearCache();
    wsUtils.sendDashboardUpdate('serviceHistory', 'maintenanceHistory', 'tyreHistory', 'batteryHistory');
  }
 
  // ── Build response ─────────────────────────────────────────────────────────
  const allFailed  = succeeded.length === 0;
  const allPassed  = failed.length    === 0;
 
  return {
    status:  allFailed ? 422 : 200,
    ok:      !allFailed,
    message: allFailed  ? 'All records failed to insert'
           : allPassed  ? `All ${succeeded.length} records inserted successfully`
           :              `${succeeded.length} record(s) inserted, ${failed.length} failed`,
    summary: {
      total:     records.length,
      succeeded: succeeded.length,
      failed:    failed.length,
    },
    data: { succeeded, failed },
  };
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
  insertBatchServiceHistory,
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