const mongoose = require('mongoose');
const logger = require('#shared/logger/logger');
const HTTP = require('#shared/response/response.status');
const { AppError } = require('#shared/errors/error.http');
const { paginate } = require('#shared/pagination/pagination');
const NotificationModel = require('#features/notification/notification.model');
const ComplaintModel = require('#features/fleet/complaint/complaint.model');
const { recalculateMaintenanceRecord } = require('./maintenance.record.sync');
const dashboardServices = require('#features/dashboard/dashboard.service');
const wsUtils = require('#core/socket/socket.io');
const uploadService = require('#core/upload/upload.service');
const MaintenanceModel = require('./maintenance.model');
const { buildMaintenanceFilterQuery } = require('./maintenance.query');
const { toAttachment, buildMaintenanceDocument } = require('./maintenance.helper');
const {
  SERVICE_TYPES,
  OIL_SERVICE_TYPES,
  ATTACHMENT_UPLOAD_FEATURE,
  DASHBOARD_UPDATE_EVENTS,
} = require('./maintenance.constant');

const refreshDashboard = () => {
  dashboardServices.clearDashboardCache();
  DASHBOARD_UPDATE_EVENTS.forEach((eventName) => wsUtils.dispatchDashboardUpdate(eventName));
};

const syncEquipmentMaintenanceRecord = async (regNos) => {
  try {
    await recalculateMaintenanceRecord(regNos);
  } catch (error) {
    logger.warn('[maintenance.service] syncEquipmentMaintenanceRecord failed:', error.message);
  }
};

const assertValidObjectId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Invalid maintenance ID', HTTP.BAD_REQUEST);
};

const assertValidPayload = (body) => {
  if (!SERVICE_TYPES.includes(body.serviceType)) {
    throw new AppError(`Invalid service type. Must be one of: ${SERVICE_TYPES.join(', ')}`, HTTP.BAD_REQUEST);
  }
  if (!body.regNo) throw new AppError('regNo is required', HTTP.BAD_REQUEST);
  if (!body.equipment) throw new AppError('equipment is required', HTTP.BAD_REQUEST);
};

const resolveAttachments = async ({ requestedSessionIds = [], existingAttachments = [], uploadedBy }) => {
  const existingBySessionId = new Map(existingAttachments.map((attachment) => [attachment.sessionId, attachment]));
  const newSessionIds = requestedSessionIds.filter((sessionId) => !existingBySessionId.has(sessionId));

  const newSessions = newSessionIds.length
    ? await uploadService.getCompletedSessions({
        sessionIds: newSessionIds,
        uploadedBy,
        feature: ATTACHMENT_UPLOAD_FEATURE,
      })
    : [];
  const newBySessionId = new Map(newSessions.map((session) => [session._id.toString(), toAttachment(session)]));

  return requestedSessionIds.map((sessionId) => existingBySessionId.get(sessionId) || newBySessionId.get(sessionId));
};

const settleFullServiceNotification = async (body, hasFullServiceRow) => {
  if (OIL_SERVICE_TYPES.includes(body.serviceType) && hasFullServiceRow) {
    await NotificationModel.findOneAndDelete({ regNo: body.regNo });
  }
};

const fulfilComplaint = async (complaintId) => {
  await ComplaintModel.findByIdAndUpdate(complaintId, {
    $set: { workflowStatus: 'fulfilled', status: 'resolved', updatedAt: new Date() },
    $push: {
      approvalTrail: {
        approvedBy: 'SYSTEM',
        role: 'SYSTEM',
        action: 'approved',
        comments: 'Complaint fulfilled after maintenance submission',
        approvalDate: new Date(),
      },
    },
  });
};

const insertMaintenanceDocuments = async (documents) => {
  if (documents.length === 1) return MaintenanceModel.create(documents);

  const session = await mongoose.startSession();
  let createdRecords = [];

  try {
    await session.withTransaction(async () => {
      createdRecords = await MaintenanceModel.create(documents, { session, ordered: true });
    });
  } finally {
    await session.endSession();
  }

  return createdRecords;
};

const createMaintenance = async ({ body, uploadedBy, preparedAttachments }) => {
  assertValidPayload(body);

  const { rows } = body;
  if (!Array.isArray(rows) || rows.length === 0) throw new AppError('rows are required', HTTP.BAD_REQUEST);
  if (rows.some((row) => !row.date)) throw new AppError('Every row requires a date', HTTP.BAD_REQUEST);

  const dates = rows.map((row) => row.date);
  if (new Set(dates).size !== dates.length) {
    throw new AppError('Rows contain duplicate dates', HTTP.CONFLICT);
  }

  const duplicates = await MaintenanceModel.find({
    regNo: String(body.regNo),
    serviceType: body.serviceType,
    date: { $in: dates },
  })
    .select('date')
    .lean();
  if (duplicates.length) {
    throw new AppError(
      `A ${body.serviceType} record for ${body.regNo} already exists on: ${duplicates.map((record) => record.date).join(', ')}`,
      HTTP.CONFLICT
    );
  }

  const attachments =
    preparedAttachments ||
    (await resolveAttachments({
      requestedSessionIds: body.attachmentSessionIds,
      uploadedBy,
    }));

  const createdRecords = await insertMaintenanceDocuments(
    rows.map((row) => buildMaintenanceDocument(body, row, attachments))
  );

  if (body.complaintId) await fulfilComplaint(body.complaintId);
  await settleFullServiceNotification(
    body,
    rows.some((row) => row.fullService === true)
  );
  await syncEquipmentMaintenanceRecord([body.regNo]);
  refreshDashboard();

  return {
    status: HTTP.CREATED,
    ok: true,
    message: `${createdRecords.length} maintenance record${createdRecords.length !== 1 ? 's' : ''} saved`,
    data: createdRecords,
  };
};

const updateMaintenance = async ({ id, body, uploadedBy }) => {
  assertValidObjectId(id);
  assertValidPayload(body);
  if (!body.date) throw new AppError('date is required', HTTP.BAD_REQUEST);

  const existing = await MaintenanceModel.findById(id).lean();
  if (!existing) throw new AppError('Maintenance record not found', HTTP.NOT_FOUND);
  if (existing.serviceType !== body.serviceType) {
    throw new AppError('Service type cannot be changed', HTTP.BAD_REQUEST);
  }

  const attachments = await resolveAttachments({
    requestedSessionIds: body.attachmentSessionIds,
    existingAttachments: existing.attachments,
    uploadedBy,
  });

  let updated;
  try {
    updated = await MaintenanceModel.findByIdAndUpdate(
      id,
      {
        $set: { ...buildMaintenanceDocument(body, body, attachments), supervisorSigned: false },
        $inc: { revision: 1 },
      },
      { new: true, runValidators: true }
    );
  } catch (error) {
    if (error.code === 11000) throw new AppError('A record already exists for this date', HTTP.CONFLICT);
    throw error;
  }

  await settleFullServiceNotification(body, body.fullService === true);
  await syncEquipmentMaintenanceRecord([existing.regNo, body.regNo]);
  refreshDashboard();

  return { status: HTTP.OK, ok: true, message: 'Maintenance record updated', data: updated };
};

const deleteMaintenance = async (id) => {
  assertValidObjectId(id);

  const deleted = await MaintenanceModel.findByIdAndDelete(id);
  if (!deleted) throw new AppError('Maintenance record not found', HTTP.NOT_FOUND);

  await syncEquipmentMaintenanceRecord([deleted.regNo]);
  refreshDashboard();

  return { status: HTTP.OK, ok: true, message: 'Maintenance record deleted', data: { id: deleted._id } };
};

const fetchMaintenanceById = async (id) => {
  assertValidObjectId(id);

  const record = await MaintenanceModel.findById(id).lean();
  if (!record) throw new AppError('Maintenance record not found', HTTP.NOT_FOUND);

  return { status: HTTP.OK, ok: true, data: record };
};

const fetchMaintenanceList = async ({ filters, pagination }) => {
  const result = await paginate(MaintenanceModel, buildMaintenanceFilterQuery(filters), pagination, {
    sort: { date: -1, createdAt: -1 },
  });
  return { status: HTTP.OK, ok: true, data: result.data, pagination: result.pagination };
};

const fetchMaintenanceTypeCounts = async (filters) => {
  const counts = await MaintenanceModel.aggregate([
    { $match: buildMaintenanceFilterQuery({ ...filters, serviceType: null }) },
    { $group: { _id: '$serviceType', count: { $sum: 1 } } },
  ]);

  const breakdown = { oil: 0, normal: 0, tyre: 0, battery: 0, major: 0 };
  let total = 0;
  counts.forEach(({ _id, count }) => {
    if (Object.hasOwn(breakdown, _id)) breakdown[_id] = count;
    total += count;
  });

  return { status: HTTP.OK, ok: true, data: { total, ...breakdown } };
};

const fetchMaintenanceDocuments = async (filters) => {
  const data = await MaintenanceModel.find(buildMaintenanceFilterQuery(filters))
    .sort({ date: -1, regNo: 1 })
    .lean();
  return { status: HTTP.OK, ok: true, data };
};

const fetchMaintenanceByRegNo = async ({ regNo, serviceType }) => {
  const data = await MaintenanceModel.find({
    regNo: String(regNo),
    ...(serviceType ? { serviceType } : {}),
  })
    .sort({ date: -1 })
    .lean();
  return { status: HTTP.OK, ok: true, data };
};

const fetchLatestFullService = async (regNo) => {
  const record = await MaintenanceModel.findOne({ regNo: String(regNo), fullService: true })
    .sort({ date: -1 })
    .lean();
  return { status: HTTP.OK, ok: true, data: record || null };
};

const fetchFullServiceNotification = async () => {
  const notifications = await NotificationModel.find({});
  return { status: HTTP.OK, ok: true, data: notifications };
};

module.exports = {
  createMaintenance,
  updateMaintenance,
  deleteMaintenance,
  fetchMaintenanceById,
  fetchMaintenanceList,
  fetchMaintenanceTypeCounts,
  fetchMaintenanceDocuments,
  fetchMaintenanceByRegNo,
  fetchLatestFullService,
  fetchFullServiceNotification,
};