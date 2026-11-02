const path = require('path');
const {
  COMPLAINT_MEDIA_TYPE,
  VIDEO_EXTENSIONS,
  AUDIO_EXTENSIONS,
} = require('./complaint.constant');

const resolveMediaType = (mimeType, fileName) => {
  const normalizedMimeType = (mimeType || '').toLowerCase();
  if (normalizedMimeType === 'video' || normalizedMimeType.startsWith('video/')) {
    return COMPLAINT_MEDIA_TYPE.VIDEO;
  }
  if (normalizedMimeType === 'audio' || normalizedMimeType.startsWith('audio/')) {
    return COMPLAINT_MEDIA_TYPE.AUDIO;
  }

  const extension = fileName ? path.extname(fileName).toLowerCase() : '';
  if (VIDEO_EXTENSIONS.includes(extension)) return COMPLAINT_MEDIA_TYPE.VIDEO;
  if (AUDIO_EXTENSIONS.includes(extension)) return COMPLAINT_MEDIA_TYPE.AUDIO;
  return COMPLAINT_MEDIA_TYPE.PHOTO;
};

const buildMediaFilesFromSessions = (sessions) =>
  sessions.map((session) => ({
    fileName: session.fileName,
    originalName: session.originalName,
    filePath: session.s3Key,
    mimeType: session.mimeType,
    type: resolveMediaType(session.mimeType, session.originalName),
    uploadDate: session.completedAt,
  }));

const buildMediaFilesFromAttachments = (attachments = []) =>
  (Array.isArray(attachments) ? attachments : [])
    .filter((attachment) => attachment?.filePath)
    .map((attachment) => {
      const fileName = attachment.fileName || attachment.filePath.split('/').pop();
      return {
        fileName,
        originalName: fileName,
        filePath: attachment.filePath,
        fileSize: Number(attachment.fileSize) || undefined,
        mimeType: attachment.mimeType,
        type: resolveMediaType(attachment.mimeType, fileName),
        uploadDate: new Date(),
      };
    });

const buildMobilizationRecord = (equipment, previousStatus, newStatus, remarks) => {
  const now = new Date();
  const time = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  let operatorName = null;
  if (equipment.certificationBody?.length > 0) {
    const lastOperator = equipment.certificationBody[equipment.certificationBody.length - 1];
    operatorName = typeof lastOperator === 'object' ? lastOperator.operatorName : lastOperator;
  }

  return {
    equipmentId: equipment._id,
    regNo: equipment.regNo,
    machine: equipment.machine,
    action: 'status_changed',
    previousStatus,
    newStatus,
    site: equipment.site?.length > 0 ? equipment.site[equipment.site.length - 1] : 'Workshop',
    operator: operatorName,
    withOperator: !!operatorName,
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    date: now,
    time,
    remarks,
    status: newStatus,
  };
};

module.exports = {
  resolveMediaType,
  buildMediaFilesFromSessions,
  buildMediaFilesFromAttachments,
  buildMobilizationRecord,
};