// services/report.service.js
const serviceHistoryModel   = require('../models/history.model.js');
const tyreHistoryModel      = require('../models/tyre.model.js');
const batteryHistoryModel   = require('../models/battery.model.js');
const maintanceHistoryModel = require('../models/maintenance.model.js');
const serviceReportModel    = require('../models/report.model.js');
const { createNotification }  = require('./notification.service.js');
const PushNotificationService = require('../push/notification.push.js');
const { default: wsUtils } = require('../sockets/websocket.js');
const analyser = require('../analyser/dashboard.analyser');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the correct history model for a given service type.
 * @param {string} serviceType
 * @returns {Model}
 */
const getHistoryModel = (serviceType) => {
  switch (serviceType) {
    case 'tyre':        return tyreHistoryModel;
    case 'battery':     return batteryHistoryModel;
    case 'maintenance': return maintanceHistoryModel;
    default:            return serviceHistoryModel; // oil | normal | fallback
  }
};

/**
 * Converts a DD-MM-YYYY string to YYYY-MM-DD.
 * @param {string} dateStr
 * @returns {string}
 */
const toISODate = (dateStr) => {
  const [d, m, y] = dateStr.split('-');
  return `${y}-${m}-${d}`;
};

/**
 * Formats a Date object to YYYY-MM-DD.
 * @param {Date} date
 * @returns {string}
 */
const formatDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Groups a flat report array into { oil, maintenance, tyre, battery, normal, other }
 * and also by regNo.
 * @param {Array} reports
 * @returns {{ groupedByType, groupedByRegNo }}
 */
const groupReports = (reports) => {
  const groupedByType  = { oil: [], maintenance: [], tyre: [], battery: [], normal: [], other: [] };
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
 * Builds statistics from grouped report data.
 * @param {Array} reports
 * @param {{ groupedByType, groupedByRegNo }} grouped
 * @returns {object}
 */
const buildStats = (reports, { groupedByType, groupedByRegNo }) => ({
  total:          reports.length,
  totalEquipment: Object.keys(groupedByRegNo).length,
  byType: {
    oil:         groupedByType.oil.length,
    maintenance: groupedByType.maintenance.length,
    tyre:        groupedByType.tyre.length,
    battery:     groupedByType.battery.length,
    normal:      groupedByType.normal.length,
    other:       groupedByType.other.length,
  },
});

/**
 * Inspects checklist items for a given set of IDs and returns 'Change' or 'Check'.
 * @param {Array}  checklistItems
 * @param {Array}  itemIds
 * @returns {string}
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
 * Creates a new service report and links it to the matching history record.
 * @param {object} data
 * @returns {Promise<object>}
 */
const insertServiceReport = async (data) => {
  try {
    if (!data?.regNo || !data?.date) throw new Error('Missing required data: regNo and date are required');

    const HistoryModel = getHistoryModel(data.serviceType);

    const correspondingHistory = data.historyId
      ? await HistoryModel.findById(data.historyId)
      : await HistoryModel.findOne({ regNo: data.regNo, date: data.date });

    if (!correspondingHistory) {
      throw new Error(`No history record found for ${data.historyId ? 'historyId: ' + data.historyId : 'regNo: ' + data.regNo + ' and date: ' + data.date}`);
    }

    const result = await serviceReportModel.create({ ...data, historyId: correspondingHistory._id.toString() });
    if (!result) throw new Error(`Failed to create service report for regNo: ${data.regNo}`);

    correspondingHistory.reportId    = result._id.toString();
    correspondingHistory.serviceType = data.serviceType;
    await correspondingHistory.save();

    const officeMain = JSON.parse(process.env.OFFICE_MAIN);
    const title      = `${data.machine} - ${data.regNo} serviced`;
    const body       = `At ${data.location}\nServiced Hours: ${data.serviceHrs}\nNext Service: ${data.nextServiceHrs}\n${data.remarks}\nMechanics: ${data.mechanics}`;

    await createNotification({ title, description: body, priority: 'high', sourceId: 'from applications', recipient: officeMain, time: new Date() });
    await PushNotificationService.sendGeneralNotification(officeMain, title, body, 'high', 'normal');
    
    analyser.clearCache();
    wsUtils.sendDashboardUpdate('serviceReport');

    return { status: 200, ok: true, message: 'Service report created successfully', data: { serviceReport: result } };
  } catch (error) {
    console.error('[ReportService] insertServiceReport:', error);
    throw { status: 500, ok: false, message: `Error creating service report: ${error.message}`, error: error.message };
  }
};

/**
 * Updates a service report by ID and syncs the corresponding history record.
 * @param {string} id
 * @param {object} updateData
 * @returns {Promise<object>}
 */
const updateServiceReportWith = async (id, updateData) => {
  try {
    const updated = await serviceReportModel.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    if (!updated) throw { success: false, message: 'Service report not found', status: 404 };

    const oilFilterStatus  = getFilterStatus(updated.checklistItems, [1]);
    const fuelFilterStatus = getFilterStatus(updated.checklistItems, [2]);
    const airFilterStatus  = getFilterStatus(updated.checklistItems, [3]);

    const historyUpdate = {
      date:           updated.date,
      oil:            oilFilterStatus,
      oilFilter:      oilFilterStatus,
      fuelFilter:     fuelFilterStatus,
      waterSeparator: 'Check',
      airFilter:      airFilterStatus,
      serviceHrs:     parseInt(updated.serviceHrs)     || 0,
      nextServiceHrs: parseInt(updated.nextServiceHrs) || 0,
    };

    const HistoryModel = getHistoryModel(updated.serviceType);

    const [updatedHistory] = await Promise.all([
      HistoryModel.findByIdAndUpdate(updated.historyId, historyUpdate, { new: true, runValidators: true }),
      HistoryModel.findOneAndUpdate({ date: updated.date, regNo: updated.regNo }, historyUpdate, { new: true, runValidators: true }),
    ]);

    if (!updatedHistory) {
      console.warn('[ReportService] updateServiceReportWith — history not found for historyId:', updated.historyId);
    }

    return { status: 200, success: true, message: 'Service report and history updated successfully', data: { serviceReport: updated, serviceHistory: updatedHistory } };
  } catch (error) {
    console.error('[ReportService] updateServiceReportWith:', error);
    throw { success: false, message: 'Failed to update service report', error: error.message || error, status: error.status || 500 };
  }
};

/**
 * Deletes a service report and its linked history record.
 * @param {string} id
 * @returns {Promise<object>}
 */
const deleteServiceReportWith = async (id) => {
  try {
    const toDelete = await serviceReportModel.findById(id);
    if (!toDelete) throw { success: false, message: 'Service report not found', status: 404 };

    const { historyId, serviceType } = toDelete;

    const deleted = await serviceReportModel.findByIdAndDelete(id);
    if (!deleted) throw { success: false, message: 'Failed to delete service report', status: 500 };

    const HistoryModel     = getHistoryModel(serviceType);
    const deletedHistory   = historyId ? await HistoryModel.findByIdAndDelete(historyId) : null;

    return {
      success: true,
      message: 'Service report and corresponding service history deleted successfully',
      data: {
        deletedServiceReport: { id: deleted._id, regNo: deleted.regNo, date: deleted.date, machine: deleted.machine, serviceType: deleted.serviceType },
        deletedServiceHistory: deletedHistory ? { id: deletedHistory._id, regNo: deletedHistory.regNo, date: deletedHistory.date, serviceType: deletedHistory.serviceType } : null,
      },
    };
  } catch (error) {
    console.error('[ReportService] deleteServiceReportWith:', error);
    throw { success: false, message: 'Failed to delete service report', error: error.message || error, status: error.status || 500 };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Read
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns service reports matching regNo and date (DD-MM-YYYY).
 * @param {string} paramRegNO
 * @param {string} paramDate - DD-MM-YYYY
 * @returns {Promise<object>}
 */
const fetchServiceReport = async (paramRegNO, paramDate) => {
  try {
    const data = await serviceReportModel.find({ regNo: paramRegNO, date: toISODate(paramDate) });
    return { status: 200, ok: true, data };
  } catch (error) {
    console.error('[ReportService] fetchServiceReport:', error);
    throw { status: 500, ok: false, message: error.message || 'Error fetching Reports' };
  }
};

/**
 * Returns a single service report by ID.
 * @param {string} id
 * @returns {Promise<object>}
 */
const fetchServiceReportWith = async (id) => {
  try {
    const report = await serviceReportModel.findById(id);
    if (!report) throw { status: 404, ok: false, message: 'Service report not found' };
    return { status: 200, ok: true, data: report };
  } catch (error) {
    console.error('[ReportService] fetchServiceReportWith:', error);
    throw { status: error.status || 500, ok: false, message: error.message || 'Error fetching Reports' };
  }
};

/**
 * Returns all service reports for a regNo, optionally filtered by service types.
 * @param {string}   regNo
 * @param {Array}    serviceTypes
 * @returns {Promise<object>}
 */
const fetchAllServiceHistories = async (regNo, serviceTypes = []) => {
  try {
    const query = { regNo };
    if (serviceTypes?.length) query.serviceType = { $in: serviceTypes };

    const data = await serviceReportModel.find(query).sort({ date: -1 });
    return { status: 200, ok: true, data };
  } catch (error) {
    console.error('[ReportService] fetchAllServiceHistories:', error);
    throw { status: 500, ok: false, message: error.message || 'Error fetching all service histories' };
  }
};

/**
 * Returns service reports for a regNo filtered by service type, newest first.
 * @param {string} regNo
 * @param {string} serviceType
 * @returns {Promise<object>}
 */
const fetchServicesByType = async (regNo, serviceType) => {
  try {
    const data = await serviceReportModel.find({ regNo, serviceType }).sort({ date: -1 });
    return { status: 200, ok: true, data };
  } catch (error) {
    console.error(`[ReportService] fetchServicesByType (${serviceType}):`, error);
    throw { status: 500, ok: false, message: error.message || `Error fetching ${serviceType} services` };
  }
};

/**
 * Returns all service reports within a named time period (daily, yesterday, weekly, monthly, yearly).
 * Response includes grouping by type and regNo plus summary statistics.
 * @param {string} period
 * @returns {Promise<object>}
 */
const fetchServicesByPeriod = async (period) => {
  try {
    const now = new Date();
    let startDate, endDate = new Date(now);

    switch (period) {
      case 'daily':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'yesterday': {
        const y = new Date(now); y.setDate(y.getDate() - 1);
        startDate = new Date(y.getFullYear(), y.getMonth(), y.getDate());
        endDate   = new Date(y.getFullYear(), y.getMonth(), y.getDate());
        break;
      }
      case 'weekly':    startDate = new Date(now); startDate.setDate(now.getDate() - 7);   break;
      case 'monthly':   startDate = new Date(now); startDate.setDate(now.getDate() - 30);  break;
      case 'yearly':    startDate = new Date(now); startDate.setDate(now.getDate() - 365); break;
      default: throw new Error('Invalid period specified');
    }

    const formattedStart = formatDate(startDate);
    const formattedEnd   = formatDate(endDate);

    const reports  = await serviceReportModel.find({ date: { $gte: formattedStart, $lte: formattedEnd } }).sort({ date: -1, regNo: 1 });
    const grouped  = groupReports(reports);
    const stats    = buildStats(reports, grouped);

    return {
      status: 200, ok: true, period,
      dateRange: { from: formattedStart, to: formattedEnd },
      statistics: { ...stats, byEquipment: Object.keys(grouped.groupedByRegNo).map(r => ({ regNo: r, count: grouped.groupedByRegNo[r].length })) },
      data: { all: reports, ...grouped },
    };
  } catch (error) {
    console.error(`[ReportService] fetchServicesByPeriod (${period}):`, error);
    throw { status: 500, ok: false, message: error.message || `Error fetching ${period} services` };
  }
};

/**
 * Returns service reports for a regNo within a DD-MM-YYYY date range.
 * @param {string} regNo
 * @param {string} startDate - DD-MM-YYYY
 * @param {string} endDate   - DD-MM-YYYY
 * @returns {Promise<object>}
 */
const fetchServicesByDateRange = async (regNo, startDate, endDate) => {
  try {
    const data = await serviceReportModel.find({ regNo, date: { $gte: toISODate(startDate), $lte: toISODate(endDate) } }).sort({ date: -1 });
    return { status: 200, ok: true, data };
  } catch (error) {
    console.error('[ReportService] fetchServicesByDateRange:', error);
    throw { status: 500, ok: false, message: error.message || 'Error fetching services by date range' };
  }
};

/**
 * Returns service reports for a regNo over the last N calendar months.
 * @param {string} regNo
 * @param {number} monthsCount
 * @returns {Promise<object>}
 */
const fetchServicesByLastMonths = async (regNo, monthsCount) => {
  try {
    const now            = new Date();
    const start          = new Date(now.getFullYear(), now.getMonth() - monthsCount + 1, 1);
    const formattedStart = formatDate(start);
    const formattedNow   = formatDate(now);

    const data = await serviceReportModel.find({ regNo, date: { $gte: formattedStart, $lte: formattedNow } }).sort({ date: -1 });
    return { status: 200, ok: true, data };
  } catch (error) {
    console.error('[ReportService] fetchServicesByLastMonths:', error);
    throw { status: 500, ok: false, message: error.message || 'Error fetching services by last months' };
  }
};

/**
 * Returns all service reports across all equipment within a DD-MM-YYYY date range.
 * Response includes grouping and summary statistics.
 * @param {string} startDate - DD-MM-YYYY
 * @param {string} endDate   - DD-MM-YYYY
 * @returns {Promise<object>}
 */
const fetchAllServicesByDateRange = async (startDate, endDate) => {
  try {
    const formattedStart = toISODate(startDate);
    const formattedEnd   = toISODate(endDate);

    const reports = await serviceReportModel.find({ date: { $gte: formattedStart, $lte: formattedEnd } }).sort({ date: -1, regNo: 1 });
    const grouped = groupReports(reports);

    return {
      status: 200, ok: true, period: 'custom',
      dateRange: { from: formattedStart, to: formattedEnd },
      statistics: buildStats(reports, grouped),
      data: { all: reports, ...grouped },
    };
  } catch (error) {
    console.error('[ReportService] fetchAllServicesByDateRange:', error);
    throw { status: 500, ok: false, message: error.message || 'Error fetching services by date range' };
  }
};

/**
 * Returns all service reports across all equipment for the last N calendar months.
 * Response includes grouping and summary statistics.
 * @param {number} monthsCount
 * @returns {Promise<object>}
 */
const fetchAllServicesByLastMonths = async (monthsCount) => {
  try {
    const now            = new Date();
    const start          = new Date(now.getFullYear(), now.getMonth() - monthsCount + 1, 1);
    const formattedStart = formatDate(start);
    const formattedEnd   = formatDate(now);

    const reports = await serviceReportModel.find({ date: { $gte: formattedStart, $lte: formattedEnd } }).sort({ date: -1, regNo: 1 });
    const grouped = groupReports(reports);

    return {
      status: 200, ok: true, period: `last-${monthsCount}-months`,
      dateRange: { from: formattedStart, to: formattedEnd },
      statistics: buildStats(reports, grouped),
      data: { all: reports, ...grouped },
    };
  } catch (error) {
    console.error('[ReportService] fetchAllServicesByLastMonths:', error);
    throw { status: 500, ok: false, message: error.message || 'Error fetching services by last months' };
  }
};

/**
 * Returns service reports for a regNo filtered by type and date range.
 * Accepts either a single serviceType string or a serviceTypes array (array takes priority).
 * @param {string}   regNo
 * @param {string}   serviceType
 * @param {string}   startDate - DD-MM-YYYY
 * @param {string}   endDate   - DD-MM-YYYY
 * @param {Array}    serviceTypes
 * @returns {Promise<object>}
 */
const fetchServicesByTypeAndDateRange = async (regNo, serviceType, startDate, endDate, serviceTypes = []) => {
  try {
    const query = { regNo, date: { $gte: toISODate(startDate), $lte: toISODate(endDate) } };
    if (serviceTypes?.length)  query.serviceType = { $in: serviceTypes };
    else if (serviceType)      query.serviceType = serviceType;

    const data = await serviceReportModel.find(query).sort({ date: -1 });
    return { status: 200, ok: true, data };
  } catch (error) {
    console.error('[ReportService] fetchServicesByTypeAndDateRange:', error);
    throw { status: 500, ok: false, message: error.message || 'Error fetching services by type and date range' };
  }
};

/**
 * Returns service reports for a regNo filtered by type and last N months.
 * Accepts either a single serviceType string or a serviceTypes array (array takes priority).
 * @param {string}   regNo
 * @param {string}   serviceType
 * @param {number}   monthsCount
 * @param {Array}    serviceTypes
 * @returns {Promise<object>}
 */
const fetchServicesByTypeAndLastMonths = async (regNo, serviceType, monthsCount, serviceTypes = []) => {
  try {
    const now            = new Date();
    const start          = new Date(now.getFullYear(), now.getMonth() - monthsCount + 1, 1);
    const formattedStart = formatDate(start);
    const formattedNow   = formatDate(now);

    const query = { regNo, date: { $gte: formattedStart, $lte: formattedNow } };
    if (serviceTypes?.length)  query.serviceType = { $in: serviceTypes };
    else if (serviceType)      query.serviceType = serviceType;

    const data = await serviceReportModel.find(query).sort({ date: -1 });
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