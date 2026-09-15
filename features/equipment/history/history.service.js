const logger = require('#shared/logger/logger');
const HTTP = require('#shared/response/response.status');
const mongoose = require('mongoose');

const { paginate } = require('#shared/pagination/pagination');
const ServiceHistoryModel = require('./history.model');
const NotificationModel = require('#core/notification/notification.model');
const ServiceReportModel = require('../report/report.model');
const EquipmentModel = require('../equipment.model');
const { createNotification } = require('#core/notification/notification.service');
const PushNotificationService = require('#core/notification/notification.push');
const wsUtils = require('#core/socket/socket.io');
const dashboardServices = require('#features/dashboard/dashboard.service')
const { buildDateFilterQuery } = require('./history.query');

const VALID_SERVICE_TYPES = ['oil', 'normal', 'tyre', 'battery', 'major'];
const OIL_SERVICE_TYPES = new Set(['oil', 'normal']);
const FULL_SERVICE_INTERVAL = 3000;

const parseServiceHours = (value) => parseInt(String(value ?? '').replace(/[^0-9]/g, ''), 10);

const crossesFullServiceInterval = (currentHrs, nextHrs) => {
  const current = parseServiceHours(currentHrs);
  const next = parseServiceHours(nextHrs);
  if (isNaN(current) || isNaN(next)) return false;
  return Math.floor(next / FULL_SERVICE_INTERVAL) > Math.floor(current / FULL_SERVICE_INTERVAL);
};

const equipmentLabel = (equipment, regNo) =>
  equipment ? `${equipment.brand} ${equipment.machine} ${regNo}` : String(regNo);

const incrementMaintenanceRecord = async (regNo, type, count = 1, session = null) => {
  if (!VALID_SERVICE_TYPES.includes(type) || !count) return;
  try {
    await EquipmentModel.updateOne(
      { regNo: String(regNo) },
      { $inc: { [`maintenanceRecord.${type}`]: count } },
      session ? { session } : {}
    );
  } catch (err) {
    logger.warn('[history.service] incrementMaintenanceRecord failed (non-fatal):', err.message);
  }
};

const notifyFullServiceDue = async (regNo, serviceHrs, nextServiceHrs) => {
  if (!crossesFullServiceInterval(serviceHrs, nextServiceHrs)) return;

  const equipment = await EquipmentModel.findOne({ regNo });
  const label = equipmentLabel(equipment, regNo);
  const title = `Time to full service - ${label}`;
  const message = `${label}'s next service is full service, NEXT SERVICE HR/KM: ${nextServiceHrs}`;

  const notification = await createNotification({
    title,
    description: message,
    priority: 'high',
    sourceId: 'from applications',
    time: new Date(),
  });

  await PushNotificationService.sendGeneralNotification(
    null,
    title,
    message,
    'high',
    'normal',
    notification.data._id.toString()
  );
};

const buildHistoryDocument = (type, record, shared) => {
  const isOilService = OIL_SERVICE_TYPES.has(type);
  const isTyreService = type === 'tyre';
  const isBatteryService = type === 'battery';

  return {
    regNo: String(shared.regNo ?? record.regNo),
    serviceType: type,
    date: record.date,
    equipment: shared.machine || shared.equipment || null,
    location: shared.location || record.location || null,
    operator: shared.operator || shared.operatorName || record.operator || null,
    mechanics: shared.mechanics || record.mechanics || null,
    remarks: shared.remarks || record.remarks || record.workRemarks || null,

    serviceHrs: record.serviceHrs || record.runningHours || null,
    nextServiceHrs: record.nextServiceHrs || null,
    fullService: isOilService ? (record.fullService ?? false) : false,

    oil: isOilService ? shared.oil || 'Check' : null,
    oilFilter: isOilService ? shared.oilFilter || 'Check' : null,
    fuelFilter: isOilService ? shared.fuelFilter || 'Check' : null,
    acFilter: isOilService ? shared.acFilter || 'Clean' : null,
    waterSeparator: isOilService ? shared.waterSeparator || 'Check' : null,
    airFilter: isOilService ? shared.airFilter || 'Clean' : null,

    tyreModel: isTyreService ? shared.tyreModel || record.tyreModel || null : null,
    tyreNumber: isTyreService ? shared.tyreNumber || record.tyreNumber || null : null,
    runningHours: isTyreService ? record.runningHours || record.serviceHrs || null : null,

    batteryModel: isBatteryService ? shared.batteryModel || record.batteryModel || null : null,

    reportId: null,
  };
};

const buildReportDocument = (type, record, shared, historyId) => ({
  regNo: String(shared.regNo ?? record.regNo),
  machine: shared.machine || shared.equipment || '',
  date: record.date,
  serviceHrs: record.serviceHrs || record.runningHours || '',
  nextServiceHrs: record.nextServiceHrs || '',
  serviceType: type,
  location: shared.location || record.location || '',
  mechanics: shared.mechanics || record.mechanics || '',
  operatorName: shared.operator || shared.operatorName || record.operator || '',
  remarks: shared.remarks || record.remarks || record.workRemarks || '',
  checklistItems: shared.checklistItems || [],
  historyId,
});

const findDuplicateRecords = async (type, records, shared) => {
  const issues = [];

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const label = `Record #${i + 1} (${record.date || 'no date'})`;

    if (!record.date) {
      issues.push(`${label}: date is required`);
      continue;
    }

    const existing = await ServiceHistoryModel.findOne({
      regNo: String(shared.regNo),
      serviceType: type,
      date: record.date,
    });

    if (existing) {
      issues.push(
        `${label}: a ${type} record for ${shared.regNo} on ${record.date} already exists — remove this entry and resubmit`
      );
    }
  }

  return issues;
};

const insertServiceHistory = async (data) => {
  try {
    const type = data.serviceType;
    const regNo = data.regNo ?? data.equipmentNo;

    const existing = await ServiceHistoryModel.findOne({
      regNo: String(regNo),
      serviceType: type,
      date: data.date,
    });
    if (existing) {
      return { status: HTTP.CONFLICT, ok: false, message: 'data is already added' };
    }

    const historyDoc = buildHistoryDocument(type, data, data);
    const history = await ServiceHistoryModel.create(historyDoc);

    await incrementMaintenanceRecord(regNo, type, 1);

    if (OIL_SERVICE_TYPES.has(type) && data.fullService === true) {
      await NotificationModel.findOneAndDelete({ regNo: data.regNo });
    }

    dashboardServices.clearDashboardCache()
    wsUtils.dispatchDashboardUpdate('serviceHistory');

    return {
      status: HTTP.OK,
      ok: true,
      message: 'Service history added successfully',
      data: history,
    };
  } catch (error) {
    if (error.code === 11000) {
      return { status: HTTP.CONFLICT, ok: false, message: 'data is already added' };
    }
    logger.error('[history.service] insertServiceHistory:', error);
    return {
      status: HTTP.INTERNAL_SERVER_ERROR,
      ok: false,
      message: 'Failed to insert service history',
      error: error.message,
    };
  }
};

const insertBatchServiceHistory = async (body) => {
  const { type, sharedData, records } = body;

  if (!type) return { status: HTTP.BAD_REQUEST, ok: false, message: 'type is required' };
  if (!VALID_SERVICE_TYPES.includes(type)) {
    return {
      status: HTTP.BAD_REQUEST,
      ok: false,
      message: `Invalid type. Must be one of: ${VALID_SERVICE_TYPES.join(', ')}`,
    };
  }
  if (!sharedData?.regNo) return { status: HTTP.BAD_REQUEST, ok: false, message: 'sharedData.regNo is required' };
  if (!sharedData?.machine) return { status: HTTP.BAD_REQUEST, ok: false, message: 'sharedData.machine is required' };
  if (!Array.isArray(records) || !records.length) {
    return { status: HTTP.BAD_REQUEST, ok: false, message: 'records array is required and must not be empty' };
  }

  const duplicateIssues = await findDuplicateRecords(type, records, sharedData);
  if (duplicateIssues.length > 0) {
    return {
      status: HTTP.UNPROCESSABLE_ENTITY,
      ok: false,
      message: `Batch rejected — ${duplicateIssues.length} issue${duplicateIssues.length > 1 ? 's' : ''} must be fixed before submitting`,
      errors: duplicateIssues,
      data: {
        succeeded: [],
        failed: duplicateIssues.map((reason, index) => ({ index, reason })),
      },
    };
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  const succeeded = [];

  try {
    for (let i = 0; i < records.length; i++) {
      const record = records[i];

      const historyDoc = buildHistoryDocument(type, record, sharedData);
      const [history] = await ServiceHistoryModel.create([historyDoc], { session });

      const reportDoc = buildReportDocument(type, record, sharedData, history._id.toString());
      const [report] = await ServiceReportModel.create([reportDoc], { session });

      history.reportId = report._id.toString();
      await history.save({ session });

      succeeded.push({ index: i, date: record.date, historyId: history._id, reportId: report._id });

      if (OIL_SERVICE_TYPES.has(type)) {
        notifyFullServiceDue(sharedData.regNo, record.serviceHrs, record.nextServiceHrs).catch((err) =>
          logger.warn('[history.service] notification error (non-fatal):', err.message)
        );
      }
    }

    await incrementMaintenanceRecord(sharedData.regNo, type, succeeded.length, session);

    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    logger.error('[history.service] batch transaction aborted:', err);
    return {
      status: HTTP.INTERNAL_SERVER_ERROR,
      ok: false,
      message: `Batch failed — all changes rolled back. Error: ${err.message}. Fix the issue and resubmit safely.`,
      data: { succeeded: [], failed: [{ index: -1, reason: err.message }] },
    };
  }

  session.endSession();
  dashboardServices.clearDashboardCache()
  wsUtils.dispatchDashboardUpdate('serviceHistory');

  return {
    status: HTTP.OK,
    ok: true,
    message: `All ${succeeded.length} record${succeeded.length !== 1 ? 's' : ''} inserted successfully`,
    summary: { total: records.length, succeeded: succeeded.length, failed: 0 },
    data: { succeeded, failed: [] },
  };
};

const fetchServiceHistory = async (regNo) => {
  try {
    const records = await ServiceHistoryModel.find({ regNo: String(regNo) }).sort({ date: -1 });
    return { status: HTTP.OK, ok: true, data: records };
  } catch (error) {
    logger.error('[history.service] fetchServiceHistory:', error);
    return { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message };
  }
};

const fetchServiceHistoryByType = async (regNo, type) => {
  try {
    const records = await ServiceHistoryModel.find({ regNo: String(regNo), serviceType: type }).sort({ date: -1 });
    return { status: HTTP.OK, ok: true, data: records };
  } catch (error) {
    logger.error('[history.service] fetchServiceHistoryByType:', error);
    return { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message };
  }
};

const fetchServiceHistoryById = async (id) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return { status: HTTP.BAD_REQUEST, ok: false, message: 'Invalid history ID' };
    }

    const record = await ServiceHistoryModel.findById(id);
    if (!record) return { status: HTTP.NOT_FOUND, ok: false, message: 'History record not found' };

    return { status: HTTP.OK, ok: true, data: record };
  } catch (error) {
    logger.error('[history.service] fetchServiceHistoryById:', error);
    return { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message };
  }
};

const fetchServiceHistoryList = async ({
  regNos,
  serviceType,
  dateFilterMode,
  lastMonthsCount,
  customStartDate,
  customEndDate,
  pagination,
}) => {
  try {
    const query = {
      regNo: { $in: regNos.map(String) },
      ...(serviceType ? { serviceType } : {}),
      ...buildDateFilterQuery({ dateFilterMode, lastMonthsCount, customStartDate, customEndDate }),
    };

    const result = await paginate(ServiceHistoryModel, query, pagination, { sort: { date: -1, createdAt: -1 } });
    return { status: HTTP.OK, ok: true, data: result.data, pagination: result.pagination };
  } catch (error) {
    logger.error('[history.service] fetchServiceHistoryList:', error);
    return { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message || 'Error fetching service history list' };
  }
};

const fetchServiceHistoryTypeCounts = async ({
  regNos,
  dateFilterMode,
  lastMonthsCount,
  customStartDate,
  customEndDate,
}) => {
  try {
    const matchQuery = {
      regNo: { $in: regNos.map(String) },
      ...buildDateFilterQuery({ dateFilterMode, lastMonthsCount, customStartDate, customEndDate }),
    };

    const counts = await ServiceHistoryModel.aggregate([
      { $match: matchQuery },
      { $group: { _id: '$serviceType', count: { $sum: 1 } } },
    ]);

    const breakdown = { oil: 0, normal: 0, tyre: 0, battery: 0, major: 0 };
    let total = 0;
    counts.forEach(({ _id, count }) => {
      if (Object.hasOwn(breakdown, _id)) breakdown[_id] = count;
      total += count;
    });

    return { status: HTTP.OK, ok: true, data: { total, ...breakdown } };
  } catch (error) {
    logger.error('[history.service] fetchServiceHistoryTypeCounts:', error);
    return { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message || 'Error fetching service history counts' };
  }
};

const fetchLatestFullService = async (regNo) => {
  try {
    const record = await ServiceHistoryModel.findOne({ regNo: String(regNo), fullService: true }).sort({ date: -1 });
    return { status: HTTP.OK, ok: true, data: record || null };
  } catch (error) {
    logger.error('[history.service] fetchLatestFullService:', error);
    return { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message };
  }
};

const deleteServiceHistory = async (id) => {
  try {
    const record = await ServiceHistoryModel.findById(id);
    if (!record) {
      return { status: HTTP.NOT_FOUND, ok: false, message: `History record with ID ${id} not found` };
    }

    const { reportId } = record;
    await ServiceHistoryModel.findByIdAndDelete(id);

    const deletedReport = reportId ? await ServiceReportModel.findByIdAndDelete(reportId) : null;

    // Mirror the deletion in the counter so it doesn't drift upward forever.
    await incrementMaintenanceRecord(record.regNo, record.serviceType, -1);

    return {
      status: HTTP.OK,
      ok: true,
      message: 'History record and linked report deleted successfully',
      data: {
        deletedHistory: { id: record._id, regNo: record.regNo, date: record.date, serviceType: record.serviceType },
        deletedReport: deletedReport
          ? { id: deletedReport._id, regNo: deletedReport.regNo, date: deletedReport.date }
          : null,
      },
    };
  } catch (error) {
    logger.error('[history.service] deleteServiceHistory:', error);
    return {
      status: HTTP.INTERNAL_SERVER_ERROR,
      ok: false,
      message: 'Failed to delete history record',
      error: error.message,
    };
  }
};

const insertFullService = async (data) => {
  try {
    if (!data?.regNo) {
      return { status: HTTP.BAD_REQUEST, ok: false, message: 'Registration number is required' };
    }

    const equipment = await EquipmentModel.findOne({ regNo: data.regNo });
    const label = equipmentLabel(equipment, data.regNo);
    const title = `Time to full service - ${label}`;
    const message = `${label}'s next service is full service, NEXT SERVICE HR/KM: ${data.nextServiceHrs}`;

    const notification = await createNotification({
      title,
      description: message,
      priority: 'high',
      sourceId: 'from applications',
      time: new Date(),
    });

    await PushNotificationService.sendGeneralNotification(
      null,
      title,
      message,
      'high',
      'normal',
      notification.data._id.toString()
    );

    return { status: HTTP.OK, ok: true, message: 'Full service notification sent successfully' };
  } catch (error) {
    logger.error('[history.service] insertFullService:', error);
    return { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message };
  }
};

const fetchFullServiceNotification = async () => {
  try {
    const notifications = await NotificationModel.find({});
    return { status: HTTP.OK, ok: true, data: notifications };
  } catch (error) {
    logger.error('[history.service] fetchFullServiceNotification:', error);
    return { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message };
  }
};

module.exports = {
  insertServiceHistory,
  insertBatchServiceHistory,
  fetchServiceHistory,
  fetchServiceHistoryByType,
  fetchServiceHistoryById,
  fetchServiceHistoryList,
  fetchServiceHistoryTypeCounts,
  fetchLatestFullService,
  deleteServiceHistory,
  insertFullService,
  fetchFullServiceNotification,
};