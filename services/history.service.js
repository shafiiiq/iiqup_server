// services/history.service.js
const ServiceHistoryModel    = require('../models/history.model.js');
const NotificationModel      = require('../models/notification.model.js');
const ServiceReportModel     = require('../models/report.model.js');
const EquipmentModel         = require('../models/equipment.model.js');
const { createNotification } = require('./notification.service.js');
const PushNotificationService = require('../push/notification.push.js');
const mongoose               = require('mongoose');
const { default: wsUtils }   = require('../sockets/websocket.js');
const analyser               = require('../analyser/dashboard.analyser');

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const VALID_TYPES    = ['oil', 'normal', 'tyre', 'battery', 'major'];
const OIL_TYPES      = new Set(['oil', 'normal']);
const FULL_SVC_STEP  = 3000; // hrs/km boundary that triggers a full-service notification

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Strips non-numeric characters and parses to integer.
 * Returns NaN if the result is not a valid number.
 */
const parseHrs = (val) => parseInt(String(val ?? '').replace(/[^0-9]/g, ''), 10);

/**
 * Checks whether the next service value crosses a FULL_SVC_STEP boundary
 * relative to the current service value.
 */
const crossesFullServiceBoundary = (current, next) => {
  const c = parseHrs(current);
  const n = parseHrs(next);
  if (isNaN(c) || isNaN(n)) return false;
  return Math.floor(n / FULL_SVC_STEP) > Math.floor(c / FULL_SVC_STEP);
};

/**
 * Builds the equipment display label used in notifications.
 */
const equipmentLabel = (equipment, regNo) =>
  equipment ? `${equipment.brand} ${equipment.machine} ${regNo}` : String(regNo);

// ─────────────────────────────────────────────────────────────────────────────
// Notification Helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fires a full-service-due notification if the next service hrs/km crosses a
 * 3000-unit boundary. Non-fatal — caller should catch and log on error.
 */
const maybeFireFullServiceNotification = async (regNo, serviceHrs, nextServiceHrs) => {
  if (!crossesFullServiceBoundary(serviceHrs, nextServiceHrs)) return;

  const equipment  = await EquipmentModel.findOne({ regNo });
  const label      = equipmentLabel(equipment, regNo);
  const title      = `Time to full service - ${label}`;
  const message    = `${label}'s next service is full service, NEXT SERVICE HR/KM: ${nextServiceHrs}`;

  const notification = await createNotification({
    title,
    description: message,
    priority:    'high',
    sourceId:    'from applications',
    time:        new Date(),
  });

  await PushNotificationService.sendGeneralNotification(
    null, title, message, 'high', 'normal',
    notification.data._id.toString()
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// History Document Builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a unified history document from the incoming data.
 * All fields are present on the schema — irrelevant ones default to null.
 * Works for both single-insert and batch-insert flows.
 *
 * @param {string} type        - Service type: oil | normal | tyre | battery | major
 * @param {Object} record      - Per-record fields (date, serviceHrs, etc.)
 * @param {Object} shared      - Shared fields across a batch (regNo, machine, etc.)
 * @returns {Object}           - Document ready for ServiceHistoryModel.create()
 */
const buildHistoryDocument = (type, record, shared) => {
  const isOil   = OIL_TYPES.has(type);
  const isTyre  = type === 'tyre';
  const isBatt  = type === 'battery';
  const isMajor = type === 'major';

  return {
    // ── Core ──────────────────────────────────────────────────────────────────
    regNo:       String(shared.regNo ?? record.regNo),
    serviceType: type,
    date:        record.date,
    equipment:   shared.machine      || shared.equipment  || null,
    location:    shared.location     || record.location   || null,
    operator:    shared.operator     || shared.operatorName || record.operator || null,
    mechanics:   shared.mechanics    || record.mechanics  || null,
    remarks:     shared.remarks      || record.remarks    || record.workRemarks || null,

    // ── Oil / Normal ──────────────────────────────────────────────────────────
    serviceHrs:     isOil  ? (record.serviceHrs     || null) : null,
    nextServiceHrs: isOil  ? (record.nextServiceHrs || null) : null,
    fullService:    isOil  ? (record.fullService     ?? false) : false,
    oil:            isOil  ? (shared.oil            || 'Check') : null,
    oilFilter:      isOil  ? (shared.oilFilter      || 'Check') : null,
    fuelFilter:     isOil  ? (shared.fuelFilter     || 'Check') : null,
    acFilter:       isOil  ? (shared.acFilter       || 'Clean') : null,
    waterSeparator: isOil  ? (shared.waterSeparator || 'Check') : null,
    airFilter:      isOil  ? (shared.airFilter      || 'Clean') : null,

    // ── Tyre ──────────────────────────────────────────────────────────────────
    tyreModel:    isTyre ? (shared.tyreModel   || record.tyreModel   || null) : null,
    tyreNumber:   isTyre ? (shared.tyreNumber  || record.tyreNumber  || null) : null,
    runningHours: isTyre ? (record.runningHours || record.serviceHrs || null) : null,

    // ── Battery ───────────────────────────────────────────────────────────────
    batteryModel: isBatt ? (shared.batteryModel || record.batteryModel || null) : null,

    // reportId injected after report is created
    reportId: null,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Report Document Builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a service report document from shared + per-record fields.
 * historyId is injected after the history document has been saved.
 */
const buildReportDocument = (type, record, shared, historyId) => ({
  regNo:          String(shared.regNo ?? record.regNo),
  machine:        shared.machine        || shared.equipment || '',
  date:           record.date,
  serviceHrs:     record.serviceHrs     || record.runningHours || '',
  nextServiceHrs: record.nextServiceHrs || '',
  serviceType:    type,
  location:       shared.location       || record.location    || '',
  mechanics:      shared.mechanics      || record.mechanics   || '',
  operatorName:   shared.operator       || shared.operatorName || record.operator || '',
  remarks:        shared.remarks        || record.remarks     || record.workRemarks || '',
  checklistItems: shared.checklistItems || [],
  historyId,
});

// ─────────────────────────────────────────────────────────────────────────────
// Pre-flight Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates all records before any DB writes occur.
 * Checks for missing dates and duplicate entries (same regNo + date + serviceType).
 * Returns an array of human-readable error strings — empty means all clear.
 */
const preflightCheck = async (type, records, shared) => {
  const errors = [];

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const label  = `Record #${i + 1} (${record.date || 'no date'})`;

    if (!record.date) {
      errors.push(`${label}: date is required`);
      continue;
    }

    const conflict = await ServiceHistoryModel.findOne({
      regNo:       String(shared.regNo),
      serviceType: type,
      date:        record.date,
    });

    if (conflict) {
      errors.push(
        `${label}: a ${type} record for ${shared.regNo} on ${record.date} already exists — remove this entry and resubmit`
      );
    }
  }

  return errors;
};

// ─────────────────────────────────────────────────────────────────────────────
// Insert — Single Record
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inserts a single service history record.
 * Body shape mirrors the old per-type endpoints — serviceType field determines behaviour.
 */
const insertServiceHistory = async (data) => {
  try {
    const type = data.serviceType;

    // ── Duplicate check ───────────────────────────────────────────────────────
    const conflict = await ServiceHistoryModel.findOne({
      regNo:       String(data.regNo ?? data.equipmentNo),
      serviceType: type,
      date:        data.date,
    });
    if (conflict) {
      return { status: 409, ok: false, message: 'data is already added' };
    }

    // ── Build and save history ────────────────────────────────────────────────
    // For single inserts, record = data and shared = data (same object).
    const historyDoc = buildHistoryDocument(type, data, data);
    const history    = await ServiceHistoryModel.create(historyDoc);

    // ── Handle full-service notification deletion if applicable ───────────────
    if (OIL_TYPES.has(type) && data.fullService === true) {
      await NotificationModel.findOneAndDelete({ regNo: data.regNo }); 
    }

    analyser.clearCache();
    wsUtils.sendDashboardUpdate('serviceHistory');

    return { status: 200, ok: true, message: 'Service history added successfully', data: history };
  } catch (error) {
    if (error.code === 11000) {
      return { status: 409, ok: false, message: 'data is already added' };
    }
    console.error('[HistoryService] insertServiceHistory:', error);
    return { status: 500, ok: false, message: 'Failed to insert service history', error: error.message };
}
};

// ─────────────────────────────────────────────────────────────────────────────
// Insert — Batch (transaction)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bulk-inserts service history + report pairs inside a MongoDB transaction.
 * All records share a single type and equipment (sharedData.regNo).
 * If any record fails, the entire batch is rolled back.
 *
 * Expected body:
 * {
 *   type:       'oil' | 'normal' | 'tyre' | 'battery' | 'major',
 *   sharedData: { regNo, machine, location, mechanics, operator, remarks,
 *                 checklistItems, oil, oilFilter, fuelFilter, acFilter,
 *                 airFilter, waterSeparator, tyreModel, tyreNumber, batteryModel },
 *   records:    [{ date, serviceHrs?, nextServiceHrs?, runningHours?,
 *                  workRemarks?, fullService? }]
 * }
 */
const insertBatchServiceHistory = async (body) => {
  const { type, sharedData, records } = body;

  // ── Input guards ──────────────────────────────────────────────────────────
  if (!type)                                return { status: 400, ok: false, message: 'type is required' };
  if (!VALID_TYPES.includes(type))          return { status: 400, ok: false, message: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` };
  if (!sharedData?.regNo)                   return { status: 400, ok: false, message: 'sharedData.regNo is required' };
  if (!sharedData?.machine)                 return { status: 400, ok: false, message: 'sharedData.machine is required' };
  if (!Array.isArray(records) || !records.length) return { status: 400, ok: false, message: 'records array is required and must not be empty' };

  // ── Pre-flight (no writes) ────────────────────────────────────────────────
  const preflightErrors = await preflightCheck(type, records, sharedData);
  if (preflightErrors.length > 0) {
    return {
      status:  422,
      ok:      false,
      message: `Batch rejected — ${preflightErrors.length} issue${preflightErrors.length > 1 ? 's' : ''} must be fixed before submitting`,
      errors:  preflightErrors,
      data:    { succeeded: [], failed: preflightErrors.map((reason, i) => ({ index: i, reason })) },
    };
  }

  // ── Transaction ───────────────────────────────────────────────────────────
  const session   = await mongoose.startSession();
  session.startTransaction();
  const succeeded = [];

  try {
    for (let i = 0; i < records.length; i++) {
      const record = records[i];

      // History
      const historyDoc = buildHistoryDocument(type, record, sharedData);
      const [history]  = await ServiceHistoryModel.create([historyDoc], { session });

      // Report
      const reportDoc = buildReportDocument(type, record, sharedData, history._id.toString());
      const [report]  = await ServiceReportModel.create([reportDoc], { session });

      // Cross-link
      history.reportId = report._id.toString();
      await history.save({ session });

      succeeded.push({ index: i, date: record.date, historyId: history._id, reportId: report._id });

      // Full-service notification (non-fatal, outside transaction)
      if (OIL_TYPES.has(type)) {
        maybeFireFullServiceNotification(sharedData.regNo, record.serviceHrs, record.nextServiceHrs)
          .catch(err => console.warn('[HistoryService] notification error (non-fatal):', err.message));
      }
    }

    await session.commitTransaction();

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('[HistoryService] batch transaction aborted:', err);
    return {
      status:  500,
      ok:      false,
      message: `Batch failed — all changes rolled back. Error: ${err.message}. Fix the issue and resubmit safely.`,
      data:    { succeeded: [], failed: [{ index: -1, reason: err.message }] },
    };
  }

  session.endSession();

  analyser.clearCache();
  wsUtils.sendDashboardUpdate('serviceHistory');

  return {
    status:  200,
    ok:      true,
    message: `All ${succeeded.length} record${succeeded.length !== 1 ? 's' : ''} inserted successfully`,
    summary: { total: records.length, succeeded: succeeded.length, failed: 0 },
    data:    { succeeded, failed: [] },
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Fetch
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns all history records for a registration number (all types), newest first.
 */
const fetchServiceHistory = async (regNo) => {
  try {
    const records = await ServiceHistoryModel.find({ regNo: String(regNo) }).sort({ date: -1 });
    return { status: 200, ok: true, data: records };
  } catch (error) {
    console.error('[HistoryService] fetchServiceHistory:', error);
    return { status: 500, ok: false, message: error.message };
  }
};

/**
 * Returns history records filtered by type for a registration number.
 */
const fetchServiceHistoryByType = async (regNo, type) => {
  try {
    const records = await ServiceHistoryModel
      .find({ regNo: String(regNo), serviceType: type })
      .sort({ date: -1 });
    return { status: 200, ok: true, data: records };
  } catch (error) {
    console.error('[HistoryService] fetchServiceHistoryByType:', error);
    return { status: 500, ok: false, message: error.message };
  }
};

/**
 * Returns a single history record by ID.
 */
const fetchServiceHistoryById = async (id) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return { status: 400, ok: false, message: 'Invalid history ID' };
    }

    const record = await ServiceHistoryModel.findById(id);
    if (!record) return { status: 404, ok: false, message: 'History record not found' };

    return { status: 200, ok: true, data: record };
  } catch (error) {
    console.error('[HistoryService] fetchServiceHistoryById:', error);
    return { status: 500, ok: false, message: error.message };
  }
};

/**
 * Returns the most recent full-service record for a registration number.
 */
const fetchLatestFullService = async (regNo) => {
  try {
    const record = await ServiceHistoryModel
      .findOne({ regNo: String(regNo), fullService: true })
      .sort({ date: -1 });

    return { status: 200, ok: true, data: record || null };
  } catch (error) {
    console.error('[HistoryService] fetchLatestFullService:', error);
    return { status: 500, ok: false, message: error.message };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deletes a history record by ID and also removes its linked service report.
 */
const deleteServiceHistory = async (id) => {
  try {
    const record = await ServiceHistoryModel.findById(id);
    if (!record) return { status: 404, ok: false, message: `History record with ID ${id} not found` };

    const { reportId } = record;

    await ServiceHistoryModel.findByIdAndDelete(id);

    let deletedReport = null;
    if (reportId) {
      deletedReport = await ServiceReportModel.findByIdAndDelete(reportId);
    }

    return {
      status:  200,
      ok:      true,
      message: 'History record and linked report deleted successfully',
      data: {
        deletedHistory: { id: record._id, regNo: record.regNo, date: record.date, serviceType: record.serviceType },
        deletedReport:  deletedReport
          ? { id: deletedReport._id, regNo: deletedReport.regNo, date: deletedReport.date }
          : null,
      },
    };
  } catch (error) {
    console.error('[HistoryService] deleteServiceHistory:', error);
    return { status: 500, ok: false, message: 'Failed to delete history record', error: error.message };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Full Service Notifications
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a full-service-due notification for an equipment manually.
 */
const insertFullService = async (data) => {
  try {
    if (!data?.regNo) return { status: 400, ok: false, message: 'Registration number is required' };

    const equipment = await EquipmentModel.findOne({ regNo: data.regNo });
    const label     = equipmentLabel(equipment, data.regNo);
    const title     = `Time to full service - ${label}`;
    const message   = `${label}'s next service is full service, NEXT SERVICE HR/KM: ${data.nextServiceHrs}`;

    const notification = await createNotification({
      title,
      description: message,
      priority:    'high',
      sourceId:    'from applications',
      time:        new Date(),
    });

    await PushNotificationService.sendGeneralNotification(
      null, title, message, 'high', 'normal', notification.data._id.toString()
    );

    return { status: 200, ok: true, message: 'Full service notification sent successfully' };
  } catch (error) {
    console.error('[HistoryService] insertFullService:', error);
    return { status: 500, ok: false, message: error.message };
  }
};

/**
 * Returns all full-service notifications.
 */
const fetchFullServiceNotification = async () => {
  try {
    const notifications = await NotificationModel.find({});
    return { status: 200, ok: true, data: notifications };
  } catch (error) {
    console.error('[HistoryService] fetchFullServiceNotification:', error);
    return { status: 500, ok: false, message: error.message };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  insertServiceHistory,
  insertBatchServiceHistory,
  fetchServiceHistory,
  fetchServiceHistoryByType,
  fetchServiceHistoryById,
  fetchLatestFullService,
  deleteServiceHistory,
  insertFullService,
  fetchFullServiceNotification,
};