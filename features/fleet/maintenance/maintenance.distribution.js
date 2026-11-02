const HTTP = require('#shared/response/response.status');
const { AppError } = require('#shared/errors/error.http');
const maintenanceService = require('./maintenance.service');
const { maintenancePdf } = require('./maintenance.pdf.registration');
const { announceMaintenanceCreated } = require('./maintenance.notification');
const { markDocumentsViewedSafely } = require('#core/document/document.view.service');
const { rectifyComplaintFromMaintenance } = require('#features/fleet/complaint/complaint.rectification');

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_MIME_TYPE = 'application/octet-stream';

const readText = (value) => {
  const text = String(value ?? '').trim();
  return text || null;
};

const readFileNameFromPath = (filePath) => filePath.split('/').pop() || filePath;

const buildPreparedAttachments = (attachments) =>
  (Array.isArray(attachments) ? attachments : [])
    .filter((attachment) => attachment?.filePath)
    .map((attachment) => ({
      sessionId: attachment.filePath,
      s3Key: attachment.filePath,
      fileName: attachment.fileName || readFileNameFromPath(attachment.filePath),
      mimeType: attachment.mimeType || DEFAULT_MIME_TYPE,
      fileSize: Number(attachment.fileSize) || 0,
    }));

const buildMaintenanceBody = (payload, date) => ({
  regNo: readText(payload.regNo),
  serviceType: readText(payload.serviceType)?.toLowerCase() ?? null,
  equipment: readText(payload.equipment),
  location: readText(payload.location),
  operator: readText(payload.operator),
  mechanics: readText(payload.mechanics),
  remarks: readText(payload.remarks),
  tyreModel: readText(payload.tyreModel),
  tyreNumber: readText(payload.tyreNumber),
  batteryModel: readText(payload.batteryModel),
  rows: [
    {
      date,
      serviceHrs: readText(payload.serviceHrs),
      nextServiceHrs: readText(payload.nextServiceHrs),
    },
  ],
});

const submitMaintenanceDistribution = async ({ payload, notificationId, user, userId }) => {
  const date = readText(payload.date);
  if (!date || !DATE_PATTERN.test(date)) throw new AppError('Date must be in YYYY-MM-DD format', HTTP.BAD_REQUEST);

  const result = await maintenanceService.createMaintenance({
    body: buildMaintenanceBody(payload, date),
    uploadedBy: userId,
    preparedAttachments: buildPreparedAttachments(payload.attachments),
  });

  result.data.forEach((record) => {
    maintenancePdf.requestInBackground({ documentId: String(record._id), user });
  });

  announceMaintenanceCreated({
    records: result.data,
    actorUniqueCode: user.uniqueCode,
    parentNotificationId: notificationId,
  });

  markDocumentsViewedSafely({
    uniqueCode: user.uniqueCode,
    sourceKey: 'maintenance',
    documentIds: result.data.map((record) => String(record._id)),
  });

  await rectifyComplaintFromMaintenance({
    regNo: readText(payload.regNo),
    notificationId,
    user,
    remarks: readText(payload.remarks) ?? '',
    attachments: payload.attachments,
  });

  return { recordCount: result.data.length };
};

module.exports = { submitMaintenanceDistribution };