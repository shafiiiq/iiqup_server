const HTTP = require('#shared/response/response.status');
const { AppError } = require('#shared/errors/error.http');
const { markDocumentsViewedSafely } = require('#core/document/document.view.service');
const ComplaintService = require('./complaint.service');
const { announceComplaintRegistered } = require('./complaint.notification');
const { buildMediaFilesFromAttachments } = require('./complaint.helper');
const { COMPLAINT_ACTIVITY_SOURCE_KEY } = require('./complaint.constant');

const readText = (value) => {
  const text = String(value ?? '').trim();
  return text || null;
};

const submitComplaintDistribution = async ({ payload, user }) => {
  const regNo = readText(payload.regNo);
  if (!regNo) throw new AppError('Equipment No is required', HTTP.BAD_REQUEST);

  const remarks = readText(payload.remarks);
  if (!remarks) throw new AppError('Remarks are required', HTTP.BAD_REQUEST);
  const mediaFiles = buildMediaFilesFromAttachments(payload.attachments);

  const complaint = await ComplaintService.createComplaint({
    uniqueCode: user.uniqueCode,
    regNo,
    name: user.name || '',
    remarks,
    mediaFiles,
  });

  markDocumentsViewedSafely({
    uniqueCode: user.uniqueCode,
    sourceKey: COMPLAINT_ACTIVITY_SOURCE_KEY,
    documentIds: [String(complaint._id)],
  });
  announceComplaintRegistered({ complaint: complaint.toObject(), actorUniqueCode: user.uniqueCode });

  return { complaintId: complaint.complaintId };
};

module.exports = { submitComplaintDistribution };