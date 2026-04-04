// services/report.service.js
const ServiceHistoryModel    = require('../models/history.model.js');
const ServiceReportModel     = require('../models/report.model.js');
const { createNotification } = require('./notification.service.js');
const PushNotificationService = require('../push/notification.push.js');
const { default: wsUtils }   = require('../sockets/websocket.js');
const analyser               = require('../analyser/dashboard.analyser');

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const VALID_TYPES = ['oil', 'normal', 'tyre', 'battery', 'major'];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts DD-MM-YYYY → YYYY-MM-DD for MongoDB date queries.
 */
const toISODate = (dateStr) => {
  const [d, m, y] = dateStr.split('-');
  return `${y}-${m}-${d}`;
};

/**
 * Formats a Date object to YYYY-MM-DD.
 */
const formatDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Groups a flat report array by serviceType and by regNo.
 * Supports all 5 types — unknown types fall into 'other'.
 */
const groupReports = (reports) => {
  const groupedByType  = { oil: [], normal: [], tyre: [], battery: [], major: [], other: [] };
  const groupedByRegNo = {};

  reports.forEach(report => {
    const type = report.serviceType || 'other';
    (groupedByType[type] ?? groupedByType.other).push(report);

    if (!groupedByRegNo[report.regNo]) groupedByRegNo[report.regNo] = [];
    groupedByRegNo[report.regNo].push(report);
  });

  return { groupedByType, groupedByRegNo };
};

/**
 * Builds summary statistics from a grouped report set.
 */
const buildStats = (reports, { groupedByType, groupedByRegNo }) => ({
  total:          reports.length,
  totalEquipment: Object.keys(groupedByRegNo).length,
  byType: {
    oil:     groupedByType.oil.length,
    normal:  groupedByType.normal.length,
    tyre:    groupedByType.tyre.length,
    battery: groupedByType.battery.length,
    major:   groupedByType.major.length,
    other:   groupedByType.other.length,
  },
});

/**
 * Inspects checklist items at the given IDs and returns 'Change' or 'Check'.
 * Used when syncing a history record after a report update.
 */
const getFilterStatus = (checklistItems, itemIds) => {
  if (!checklistItems?.length) return 'Check';
  const relevant = checklistItems.filter(item => itemIds.includes(item.id));
  if (!relevant.length) return 'Check';
  return relevant.some(item => item.description?.toLowerCase().includes('change')) ? 'Change' : 'Check';
};

// ─────────────────────────────────────────────────────────────────────────────
// Write
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a new service report and links it to the corresponding history record.
 * Looks up history by historyId if provided, otherwise by regNo + date.
 */
const insertServiceReport = async (data) => {
  try {
    if (!data?.regNo)        throw new Error('regNo is required');
    if (!data?.date)         throw new Error('date is required');
    if (!data?.serviceType)  throw new Error('serviceType is required');

    // ── Find corresponding history record ─────────────────────────────────────
    const history = data.historyId
      ? await ServiceHistoryModel.findById(data.historyId)
      : await ServiceHistoryModel.findOne({
          regNo:       String(data.regNo),
          serviceType: data.serviceType,
          date:        data.date,
        });

    if (!history) {
      throw new Error(
        `No history record found for ${data.historyId
          ? 'historyId: ' + data.historyId
          : `regNo: ${data.regNo}, type: ${data.serviceType}, date: ${data.date}`}`
      );
    }

    // ── Create report ─────────────────────────────────────────────────────────
    const report = await ServiceReportModel.create({
      ...data,
      historyId: history._id.toString(),
    });

    // ── Back-link on history ──────────────────────────────────────────────────
    history.reportId = report._id.toString();
    await history.save();

    // ── Notification ──────────────────────────────────────────────────────────
    const officeMain = JSON.parse(process.env.OFFICE_MAIN);
    const title      = `${data.machine} - ${data.regNo} serviced`;
    const body       = `At ${data.location}\nServiced Hours: ${data.serviceHrs}\nNext Service: ${data.nextServiceHrs}\n${data.remarks}\nMechanics: ${data.mechanics}`;

    await createNotification({ title, description: body, priority: 'high', sourceId: 'from applications', recipient: officeMain, time: new Date() });
    await PushNotificationService.sendGeneralNotification(officeMain, title, body, 'high', 'normal');

    analyser.clearCache();
    wsUtils.sendDashboardUpdate('serviceReport');

    return { status: 200, ok: true, message: 'Service report created successfully', data: { serviceReport: report } };
  } catch (error) {
    console.error('[ReportService] insertServiceReport:', error);
    throw { status: 500, ok: false, message: `Error creating service report: ${error.message}`, error: error.message };
  }
};

/**
 * Updates a service report and syncs the filter/fluid flags on the linked history record.
 * Only syncs oil/normal fields when the serviceType is oil or normal.
 */
const updateServiceReportWith = async (id, updateData) => {
  try {
    const updated = await ServiceReportModel.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    if (!updated) throw { ok: false, message: 'Service report not found', status: 404 };

    // ── Sync history record ───────────────────────────────────────────────────
    let updatedHistory = null;

    if (updated.historyId) {
      const historyUpdate = { date: updated.date };

      // Only oil/normal records carry filter flags
      if (updated.serviceType === 'oil' || updated.serviceType === 'normal') {
        historyUpdate.oil            = getFilterStatus(updated.checklistItems, [1]);
        historyUpdate.oilFilter      = getFilterStatus(updated.checklistItems, [1]);
        historyUpdate.fuelFilter     = getFilterStatus(updated.checklistItems, [2]);
        historyUpdate.airFilter      = getFilterStatus(updated.checklistItems, [3]);
        historyUpdate.waterSeparator = 'Check';
        historyUpdate.serviceHrs     = updated.serviceHrs     || null;
        historyUpdate.nextServiceHrs = updated.nextServiceHrs || null;
      }

      updatedHistory = await ServiceHistoryModel.findByIdAndUpdate(
        updated.historyId,
        historyUpdate,
        { new: true, runValidators: true }
      );

      if (!updatedHistory) {
        console.warn('[ReportService] updateServiceReportWith — history not found for historyId:', updated.historyId);
      }
    }

    return {
      status:  200,
      ok:      true,
      message: 'Service report and history updated successfully',
      data:    { serviceReport: updated, serviceHistory: updatedHistory },
    };
  } catch (error) {
    console.error('[ReportService] updateServiceReportWith:', error);
    throw { ok: false, message: 'Failed to update service report', error: error.message || error, status: error.status || 500 };
  }
};

/**
 * Deletes a service report and its linked history record.
 */
const deleteServiceReportWith = async (id) => {
  try {
    const report = await ServiceReportModel.findById(id);
    if (!report) throw { ok: false, message: 'Service report not found', status: 404 };

    const { historyId } = report;

    await ServiceReportModel.findByIdAndDelete(id);

    const deletedHistory = historyId
      ? await ServiceHistoryModel.findByIdAndDelete(historyId)
      : null;

    return {
      ok:      true,
      message: 'Service report and linked history record deleted successfully',
      data: {
        deletedServiceReport: {
          id:          report._id,
          regNo:       report.regNo,
          date:        report.date,
          machine:     report.machine,
          serviceType: report.serviceType,
        },
        deletedServiceHistory: deletedHistory
          ? { id: deletedHistory._id, regNo: deletedHistory.regNo, date: deletedHistory.date, serviceType: deletedHistory.serviceType }
          : null,
      },
    };
  } catch (error) {
    console.error('[ReportService] deleteServiceReportWith:', error);
    throw { ok: false, message: 'Failed to delete service report', error: error.message || error, status: error.status || 500 };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Read — Single / By regNo + date
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns reports matching regNo and date (date param is DD-MM-YYYY).
 */
const fetchServiceReport = async (regNo, date) => {
  try {
    const data = await ServiceReportModel.find({ regNo, date: toISODate(date) });
    return { status: 200, ok: true, data };
  } catch (error) {
    console.error('[ReportService] fetchServiceReport:', error);
    throw { status: 500, ok: false, message: error.message || 'Error fetching report' };
  }
};

/**
 * Returns a single service report by ID.
 */
const fetchServiceReportWith = async (id) => {
  try {
    const report = await ServiceReportModel.findById(id);
    if (!report) throw { status: 404, ok: false, message: 'Service report not found' };
    return { status: 200, ok: true, data: report };
  } catch (error) {
    console.error('[ReportService] fetchServiceReportWith:', error);
    throw { status: error.status || 500, ok: false, message: error.message || 'Error fetching report' };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Read — Filtered queries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns all reports for a regNo, optionally filtered by an array of serviceTypes.
 */
const fetchAllServiceHistories = async (regNo, serviceTypes = []) => {
  try {
    const query = { regNo };
    if (serviceTypes?.length) query.serviceType = { $in: serviceTypes };

    const data = await ServiceReportModel.find(query).sort({ date: -1 });
    return { status: 200, ok: true, data };
  } catch (error) {
    console.error('[ReportService] fetchAllServiceHistories:', error);
    throw { status: 500, ok: false, message: error.message || 'Error fetching all service histories' };
  }
};

/**
 * Returns reports for a regNo filtered by a single serviceType, newest first.
 */
const fetchServicesByType = async (regNo, serviceType) => {
  try {
    const data = await ServiceReportModel.find({ regNo, serviceType }).sort({ date: -1 });
    return { status: 200, ok: true, data };
  } catch (error) {
    console.error(`[ReportService] fetchServicesByType (${serviceType}):`, error);
    throw { status: 500, ok: false, message: error.message || `Error fetching ${serviceType} services` };
  }
};

/**
 * Returns reports across all equipment within a named period.
 * Includes grouping by type and regNo, plus summary statistics.
 */
const fetchServicesByPeriod = async (period) => {
  try {
    const now = new Date();
    let startDate, endDate;

    switch (period) {
      case 'daily':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'yesterday': {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        startDate = new Date(y.getFullYear(), y.getMonth(), y.getDate());
        endDate   = new Date(y.getFullYear(), y.getMonth(), y.getDate());
        break;
      }
      case 'weekly':  startDate = new Date(now); startDate.setDate(now.getDate() - 7);   endDate = new Date(now); break;
      case 'monthly': startDate = new Date(now); startDate.setDate(now.getDate() - 30);  endDate = new Date(now); break;
      case 'yearly':  startDate = new Date(now); startDate.setDate(now.getDate() - 365); endDate = new Date(now); break;
      default: throw new Error('Invalid period specified');
    }

    const from    = formatDate(startDate);
    const to      = formatDate(endDate);
    const reports = await ServiceReportModel.find({ date: { $gte: from, $lte: to } }).sort({ date: -1, regNo: 1 });
    const grouped = groupReports(reports);

    return {
      status: 200, ok: true, period,
      dateRange:  { from, to },
      statistics: {
        ...buildStats(reports, grouped),
        byEquipment: Object.entries(grouped.groupedByRegNo).map(([regNo, items]) => ({ regNo, count: items.length })),
      },
      data: { all: reports, ...grouped },
    };
  } catch (error) {
    console.error(`[ReportService] fetchServicesByPeriod (${period}):`, error);
    throw { status: 500, ok: false, message: error.message || `Error fetching ${period} services` };
  }
};

/**
 * Returns reports for a regNo within a DD-MM-YYYY date range.
 */
const fetchServicesByDateRange = async (regNo, startDate, endDate) => {
  try {
    const data = await ServiceReportModel
      .find({ regNo, date: { $gte: toISODate(startDate), $lte: toISODate(endDate) } })
      .sort({ date: -1 });
    return { status: 200, ok: true, data };
  } catch (error) {
    console.error('[ReportService] fetchServicesByDateRange:', error);
    throw { status: 500, ok: false, message: error.message || 'Error fetching services by date range' };
  }
};

/**
 * Returns reports for a regNo from the last N calendar months.
 */
const fetchServicesByLastMonths = async (regNo, monthsCount) => {
  try {
    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - monthsCount + 1, 1);
    const from  = formatDate(start);
    const to    = formatDate(now);

    const data = await ServiceReportModel.find({ regNo, date: { $gte: from, $lte: to } }).sort({ date: -1 });
    return { status: 200, ok: true, data };
  } catch (error) {
    console.error('[ReportService] fetchServicesByLastMonths:', error);
    throw { status: 500, ok: false, message: error.message || 'Error fetching services by last months' };
  }
};

/**
 * Returns all reports across all equipment within a DD-MM-YYYY date range.
 * Includes grouping and statistics.
 */
const fetchAllServicesByDateRange = async (startDate, endDate) => {
  try {
    const from    = toISODate(startDate);
    const to      = toISODate(endDate);
    const reports = await ServiceReportModel.find({ date: { $gte: from, $lte: to } }).sort({ date: -1, regNo: 1 });
    const grouped = groupReports(reports);

    return {
      status: 200, ok: true, period: 'custom',
      dateRange:  { from, to },
      statistics: buildStats(reports, grouped),
      data:       { all: reports, ...grouped },
    };
  } catch (error) {
    console.error('[ReportService] fetchAllServicesByDateRange:', error);
    throw { status: 500, ok: false, message: error.message || 'Error fetching services by date range' };
  }
};

/**
 * Returns all reports across all equipment for the last N calendar months.
 * Includes grouping and statistics.
 */
const fetchAllServicesByLastMonths = async (monthsCount) => {
  try {
    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - monthsCount + 1, 1);
    const from  = formatDate(start);
    const to    = formatDate(now);

    const reports = await ServiceReportModel.find({ date: { $gte: from, $lte: to } }).sort({ date: -1, regNo: 1 });
    const grouped = groupReports(reports);

    return {
      status: 200, ok: true, period: `last-${monthsCount}-months`,
      dateRange:  { from, to },
      statistics: buildStats(reports, grouped),
      data:       { all: reports, ...grouped },
    };
  } catch (error) {
    console.error('[ReportService] fetchAllServicesByLastMonths:', error);
    throw { status: 500, ok: false, message: error.message || 'Error fetching services by last months' };
  }
};

/**
 * Returns reports for a regNo filtered by type and date range.
 * serviceTypes array takes priority over single serviceType string.
 */
const fetchServicesByTypeAndDateRange = async (regNo, serviceType, startDate, endDate, serviceTypes = []) => {
  try {
    const query = { regNo, date: { $gte: toISODate(startDate), $lte: toISODate(endDate) } };
    if (serviceTypes?.length) query.serviceType = { $in: serviceTypes };
    else if (serviceType)     query.serviceType = serviceType;

    const data = await ServiceReportModel.find(query).sort({ date: -1 });
    return { status: 200, ok: true, data };
  } catch (error) {
    console.error('[ReportService] fetchServicesByTypeAndDateRange:', error);
    throw { status: 500, ok: false, message: error.message || 'Error fetching services by type and date range' };
  }
};

/**
 * Returns reports for a regNo filtered by type from the last N months.
 * serviceTypes array takes priority over single serviceType string.
 */
const fetchServicesByTypeAndLastMonths = async (regNo, serviceType, monthsCount, serviceTypes = []) => {
  try {
    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - monthsCount + 1, 1);
    const from  = formatDate(start);
    const to    = formatDate(now);

    const query = { regNo, date: { $gte: from, $lte: to } };
    if (serviceTypes?.length) query.serviceType = { $in: serviceTypes };
    else if (serviceType)     query.serviceType = serviceType;

    const data = await ServiceReportModel.find(query).sort({ date: -1 });
    return { status: 200, ok: true, data };
  } catch (error) {
    console.error('[ReportService] fetchServicesByTypeAndLastMonths:', error);
    throw { status: 500, ok: false, message: error.message || 'Error fetching services by type and last months' };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  insertServiceReport,
  updateServiceReportWith,
  deleteServiceReportWith,
  fetchServiceReport,
  fetchServiceReportWith,
  fetchAllServiceHistories,
  fetchServicesByType,
  fetchServicesByPeriod,
  fetchServicesByDateRange,
  fetchServicesByLastMonths,
  fetchAllServicesByDateRange,
  fetchAllServicesByLastMonths,
  fetchServicesByTypeAndDateRange,
  fetchServicesByTypeAndLastMonths,
};