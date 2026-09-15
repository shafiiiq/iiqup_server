const logger = require('#shared/logger/logger');
const HTTP = require('#shared/response/response.status');

const ServiceHistoryModel = require('../history/history.model');
const ServiceReportModel = require('./report.model');
const ComplaintModel = require('../../complaint/complaint.model');
const wsUtils = require('#core/socket/socket.io');
const dashboardServices = require('#features/dashboard/dashboard.service');
const { notifyUser } = require('#shared/notify/notify.user');

const toISODate = (ddmmyyyy) => {
  const [d, m, y] = ddmmyyyy.split('-');
  return `${y}-${m}-${d}`;
};

const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const groupReports = (reports) => {
  const groupedByType = { oil: [], normal: [], tyre: [], battery: [], major: [], other: [] };
  const groupedByRegNo = {};

  reports.forEach((report) => {
    const type = report.serviceType || 'other';
    (groupedByType[type] ?? groupedByType.other).push(report);

    if (!groupedByRegNo[report.regNo]) groupedByRegNo[report.regNo] = [];
    groupedByRegNo[report.regNo].push(report);
  });

  return { groupedByType, groupedByRegNo };
};

const buildStats = (reports, { groupedByType, groupedByRegNo }) => ({
  total: reports.length,
  totalEquipment: Object.keys(groupedByRegNo).length,
  byType: {
    oil: groupedByType.oil.length,
    normal: groupedByType.normal.length,
    tyre: groupedByType.tyre.length,
    battery: groupedByType.battery.length,
    major: groupedByType.major.length,
    other: groupedByType.other.length,
  },
});

const resolveChecklistStatus = (checklistItems, itemIds) => {
  if (!checklistItems?.length) return 'Check';
  const relevant = checklistItems.filter((item) => itemIds.includes(item.id));
  if (!relevant.length) return 'Check';
  return relevant.some((item) => item.description?.toLowerCase().includes('change')) ? 'Change' : 'Check';
};

const insertServiceReport = async (data) => {
  try {
    if (!data?.regNo) throw new Error('regNo is required');
    if (!data?.date) throw new Error('date is required');
    if (!data?.serviceType) throw new Error('serviceType is required');

    const history = data.historyId
      ? await ServiceHistoryModel.findById(data.historyId)
      : await ServiceHistoryModel.findOne({
        regNo: String(data.regNo),
        serviceType: data.serviceType,
        date: data.date,
      });

    if (!history) {
      throw new Error(
        `No history record found for ${data.historyId
          ? 'historyId: ' + data.historyId
          : `regNo: ${data.regNo}, type: ${data.serviceType}, date: ${data.date}`
        }`
      );
    }

    const report = await ServiceReportModel.create({ ...data, historyId: history._id.toString() });

    if (data.complaintId) {
      const complaint = await ComplaintModel.findById(data.complaintId);
      if (complaint) {
        await ComplaintModel.findByIdAndUpdate(
          data.complaintId,
          {
            $set: { workflowStatus: 'fulfilled', status: 'resolved', updatedAt: new Date() },
            $push: {
              approvalTrail: {
                approvedBy: 'SYSTEM',
                role: 'SYSTEM',
                action: 'approved',
                comments: 'Complaint fulfilled after service report submission',
                approvalDate: new Date(),
              },
            },
          },
          { new: true }
        );
      }
    }

    history.reportId = report._id.toString();
    await history.save();

    const staffMain = JSON.parse(process.env.STAFF_MAIN);
    const title = `${data.machine} - ${data.regNo} serviced`;
    const body = `${data.date}\nAt ${data.location}\nServiced Hours: ${data.serviceHrs}\nNext Service: ${data.nextServiceHrs}\n${data.remarks}\nMechanics: ${data.mechanics}`;

    await notifyUser(staffMain,
      {
        title,
        description: body,
        priority: 'high',
        type: 'normal',
        sourceId: 'from applications',
        time: new Date(),
      });

    dashboardServices.clearDashboardCache()
    wsUtils.dispatchDashboardUpdate('serviceReport');

    return {
      status: HTTP.OK,
      ok: true,
      message: 'Service report created successfully',
      data: { serviceReport: report },
    };
  } catch (error) {
    logger.error('[report.service] insertServiceReport:', error);
    throw {
      status: HTTP.INTERNAL_SERVER_ERROR,
      ok: false,
      message: `Error creating service report: ${error.message}`,
      error: error.message,
    };
  }
};

const updateServiceReportById = async (id, updateData) => {
  try {
    const updated = await ServiceReportModel.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    if (!updated) throw { ok: false, message: 'Service report not found', status: HTTP.NOT_FOUND };

    let updatedHistory = null;

    if (updated.historyId) {
      const historyUpdate = {
        date: updated.date,
        serviceHrs: updated.serviceHrs || null,
        nextServiceHrs: updated.nextServiceHrs || null,
      };

      if (updated.serviceType === 'oil' || updated.serviceType === 'normal') {
        historyUpdate.oil = resolveChecklistStatus(updated.checklistItems, [1]);
        historyUpdate.oilFilter = resolveChecklistStatus(updated.checklistItems, [1]);
        historyUpdate.fuelFilter = resolveChecklistStatus(updated.checklistItems, [2]);
        historyUpdate.airFilter = resolveChecklistStatus(updated.checklistItems, [3]);
        historyUpdate.waterSeparator = 'Check';
      }

      updatedHistory = await ServiceHistoryModel.findByIdAndUpdate(updated.historyId, historyUpdate, {
        new: true,
        runValidators: true,
      });

      if (!updatedHistory) {
        logger.warn('[report.service] updateServiceReportById — history not found for historyId:', updated.historyId);
      }
    }

    return {
      status: HTTP.OK,
      ok: true,
      message: 'Service report and history updated successfully',
      data: { serviceReport: updated, serviceHistory: updatedHistory },
    };
  } catch (error) {
    logger.error('[report.service] updateServiceReportById:', error);
    throw {
      ok: false,
      message: 'Failed to update service report',
      error: error.message || error,
      status: error.status || HTTP.INTERNAL_SERVER_ERROR,
    };
  }
};

const deleteServiceReportById = async (id) => {
  try {
    const report = await ServiceReportModel.findById(id);
    if (!report) throw { ok: false, message: 'Service report not found', status: HTTP.NOT_FOUND };

    const { historyId } = report;
    await ServiceReportModel.findByIdAndDelete(id);

    const deletedHistory = historyId ? await ServiceHistoryModel.findByIdAndDelete(historyId) : null;

    return {
      ok: true,
      message: 'Service report and linked history record deleted successfully',
      data: {
        deletedServiceReport: {
          id: report._id,
          regNo: report.regNo,
          date: report.date,
          machine: report.machine,
          serviceType: report.serviceType,
        },
        deletedServiceHistory: deletedHistory
          ? {
            id: deletedHistory._id,
            regNo: deletedHistory.regNo,
            date: deletedHistory.date,
            serviceType: deletedHistory.serviceType,
          }
          : null,
      },
    };
  } catch (error) {
    logger.error('[report.service] deleteServiceReportById:', error);
    throw {
      ok: false,
      message: 'Failed to delete service report',
      error: error.message || error,
      status: error.status || HTTP.INTERNAL_SERVER_ERROR,
    };
  }
};

const fetchServiceReport = async (regNo, date) => {
  try {
    const data = await ServiceReportModel.find({ regNo, date: toISODate(date) });
    return { status: HTTP.OK, ok: true, data };
  } catch (error) {
    logger.error('[report.service] fetchServiceReport:', error);
    throw { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message || 'Error fetching report' };
  }
};

const fetchServiceReportById = async (id) => {
  try {
    const report = await ServiceReportModel.findById(id);
    if (!report) throw { status: HTTP.NOT_FOUND, ok: false, message: 'Service report not found' };
    return { status: HTTP.OK, ok: true, data: report };
  } catch (error) {
    logger.error('[report.service] fetchServiceReportById:', error);
    throw {
      status: error.status || HTTP.INTERNAL_SERVER_ERROR,
      ok: false,
      message: error.message || 'Error fetching report',
    };
  }
};

const fetchAllServiceHistories = async (regNo, serviceTypes = []) => {
  try {
    const query = { regNo };
    if (serviceTypes?.length) query.serviceType = { $in: serviceTypes };

    const data = await ServiceReportModel.find(query).sort({ date: -1 });
    return { status: HTTP.OK, ok: true, data };
  } catch (error) {
    logger.error('[report.service] fetchAllServiceHistories:', error);
    throw {
      status: HTTP.INTERNAL_SERVER_ERROR,
      ok: false,
      message: error.message || 'Error fetching all service histories',
    };
  }
};

const fetchServicesByType = async (regNo, serviceType) => {
  try {
    const data = await ServiceReportModel.find({ regNo, serviceType }).sort({ date: -1 });
    return { status: HTTP.OK, ok: true, data };
  } catch (error) {
    logger.error(`[report.service] fetchServicesByType (${serviceType}):`, error);
    throw {
      status: HTTP.INTERNAL_SERVER_ERROR,
      ok: false,
      message: error.message || `Error fetching ${serviceType} services`,
    };
  }
};

const PERIOD_TO_RANGE = {
  daily: (now) => {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { start, end: start };
  },
  yesterday: (now) => {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
    return { start, end: start };
  },
  weekly: (now) => {
    const start = new Date(now);
    start.setDate(now.getDate() - 7);
    return { start, end: now };
  },
  monthly: (now) => {
    const start = new Date(now);
    start.setDate(now.getDate() - 30);
    return { start, end: now };
  },
  yearly: (now) => {
    const start = new Date(now);
    start.setDate(now.getDate() - 365);
    return { start, end: now };
  },
};

const fetchServicesByPeriod = async (period) => {
  try {
    const resolveRange = PERIOD_TO_RANGE[period];
    if (!resolveRange) throw new Error('Invalid period specified');

    const { start, end } = resolveRange(new Date());
    const from = formatDate(start);
    const to = formatDate(end);

    const reports = await ServiceReportModel.find({ date: { $gte: from, $lte: to } }).sort({ date: -1, regNo: 1 });
    const grouped = groupReports(reports);

    return {
      status: HTTP.OK,
      ok: true,
      period,
      dateRange: { from, to },
      statistics: {
        ...buildStats(reports, grouped),
        byEquipment: Object.entries(grouped.groupedByRegNo).map(([regNo, items]) => ({ regNo, count: items.length })),
      },
      data: { all: reports, ...grouped },
    };
  } catch (error) {
    logger.error(`[report.service] fetchServicesByPeriod (${period}):`, error);
    throw {
      status: HTTP.INTERNAL_SERVER_ERROR,
      ok: false,
      message: error.message || `Error fetching ${period} services`,
    };
  }
};

const fetchServicesByDateRange = async (regNo, startDate, endDate) => {
  try {
    const data = await ServiceReportModel.find({
      regNo,
      date: { $gte: toISODate(startDate), $lte: toISODate(endDate) },
    }).sort({ date: -1 });
    return { status: HTTP.OK, ok: true, data };
  } catch (error) {
    logger.error('[report.service] fetchServicesByDateRange:', error);
    throw {
      status: HTTP.INTERNAL_SERVER_ERROR,
      ok: false,
      message: error.message || 'Error fetching services by date range',
    };
  }
};

const monthsAgoRange = (monthsCount) => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - monthsCount + 1, 1);
  return { from: formatDate(start), to: formatDate(now) };
};

const fetchServicesByLastMonths = async (regNo, monthsCount) => {
  try {
    const { from, to } = monthsAgoRange(monthsCount);
    const data = await ServiceReportModel.find({ regNo, date: { $gte: from, $lte: to } }).sort({ date: -1 });
    return { status: HTTP.OK, ok: true, data };
  } catch (error) {
    logger.error('[report.service] fetchServicesByLastMonths:', error);
    throw {
      status: HTTP.INTERNAL_SERVER_ERROR,
      ok: false,
      message: error.message || 'Error fetching services by last months',
    };
  }
};

const fetchAllServicesByDateRange = async (startDate, endDate) => {
  try {
    const from = toISODate(startDate);
    const to = toISODate(endDate);
    const reports = await ServiceReportModel.find({ date: { $gte: from, $lte: to } }).sort({ date: -1, regNo: 1 });
    const grouped = groupReports(reports);

    return {
      status: HTTP.OK,
      ok: true,
      period: 'custom',
      dateRange: { from, to },
      statistics: buildStats(reports, grouped),
      data: { all: reports, ...grouped },
    };
  } catch (error) {
    logger.error('[report.service] fetchAllServicesByDateRange:', error);
    throw {
      status: HTTP.INTERNAL_SERVER_ERROR,
      ok: false,
      message: error.message || 'Error fetching services by date range',
    };
  }
};

const fetchAllServicesByLastMonths = async (monthsCount) => {
  try {
    const { from, to } = monthsAgoRange(monthsCount);
    const reports = await ServiceReportModel.find({ date: { $gte: from, $lte: to } }).sort({ date: -1, regNo: 1 });
    const grouped = groupReports(reports);

    return {
      status: HTTP.OK,
      ok: true,
      period: `last-${monthsCount}-months`,
      dateRange: { from, to },
      statistics: buildStats(reports, grouped),
      data: { all: reports, ...grouped },
    };
  } catch (error) {
    logger.error('[report.service] fetchAllServicesByLastMonths:', error);
    throw {
      status: HTTP.INTERNAL_SERVER_ERROR,
      ok: false,
      message: error.message || 'Error fetching services by last months',
    };
  }
};

const fetchServicesByTypeAndDateRange = async (regNo, serviceType, startDate, endDate, serviceTypes = []) => {
  try {
    const query = { regNo, date: { $gte: toISODate(startDate), $lte: toISODate(endDate) } };
    if (serviceTypes?.length) query.serviceType = { $in: serviceTypes };
    else if (serviceType) query.serviceType = serviceType;

    const data = await ServiceReportModel.find(query).sort({ date: -1 });
    return { status: HTTP.OK, ok: true, data };
  } catch (error) {
    logger.error('[report.service] fetchServicesByTypeAndDateRange:', error);
    throw {
      status: HTTP.INTERNAL_SERVER_ERROR,
      ok: false,
      message: error.message || 'Error fetching services by type and date range',
    };
  }
};

const fetchServicesByTypeAndLastMonths = async (regNo, serviceType, monthsCount, serviceTypes = []) => {
  try {
    const { from, to } = monthsAgoRange(monthsCount);
    const query = { regNo, date: { $gte: from, $lte: to } };
    if (serviceTypes?.length) query.serviceType = { $in: serviceTypes };
    else if (serviceType) query.serviceType = serviceType;

    const data = await ServiceReportModel.find(query).sort({ date: -1 });
    return { status: HTTP.OK, ok: true, data };
  } catch (error) {
    logger.error('[report.service] fetchServicesByTypeAndLastMonths:', error);
    throw {
      status: HTTP.INTERNAL_SERVER_ERROR,
      ok: false,
      message: error.message || 'Error fetching services by type and last months',
    };
  }
};

module.exports = {
  insertServiceReport,
  updateServiceReportById,
  deleteServiceReportById,
  fetchServiceReport,
  fetchServiceReportById,
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