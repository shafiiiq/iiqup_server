const mongoose = require('mongoose');
const { getRegistryEntry } = require('#core/registry/model.registry');

const MIME_TYPE_BY_EXTENSION = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  webp: 'image/webp',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  webm: 'video/webm',
  '3gp': 'video/3gpp',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  m4a: 'audio/m4a',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
};

const buildSourceKey = (source) => `${source.modelKey}:${source.documentId}`;

const readFileName = (filePath) => filePath.split('/').pop() || filePath;

const guessMimeType = (filePath) => {
  const extension = filePath.split('.').pop()?.toLowerCase();
  return MIME_TYPE_BY_EXTENSION[extension] || 'application/octet-stream';
};

const normalizeAttachment = (value) => {
  if (typeof value === 'string' && value) {
    return { filePath: value, fileName: readFileName(value), mimeType: guessMimeType(value) };
  }
  const filePath = value?.filePath || value?.path;
  if (!filePath) return null;
  return {
    filePath,
    fileName: value.fileName || value.originalName || readFileName(filePath),
    mimeType: value.mimeType || guessMimeType(filePath),
  };
};

const collectAttachments = (document, attachmentFields) =>
  attachmentFields
    .flatMap((field) => [].concat(document[field] ?? []))
    .map(normalizeAttachment)
    .filter(Boolean);

const groupDocumentIdsByModelKey = (notifications) => {
  const groups = new Map();
  notifications.forEach((notification) => {
    const { source } = notification;
    if (!source || !mongoose.Types.ObjectId.isValid(source.documentId)) return;
    if (!getRegistryEntry(source.modelKey)?.attachmentFields.length) return;
    if (!groups.has(source.modelKey)) groups.set(source.modelKey, new Set());
    groups.get(source.modelKey).add(source.documentId);
  });
  return groups;
};

const resolveSourceAttachments = async (notifications) => {
  const attachmentsBySource = new Map();
  const groups = groupDocumentIdsByModelKey(notifications);

  await Promise.all(
    [...groups.entries()].map(async ([modelKey, documentIds]) => {
      const { model, attachmentFields } = getRegistryEntry(modelKey);
      const documents = await model.find({ _id: { $in: [...documentIds] } }).select(attachmentFields.join(' ')).lean();
      documents.forEach((document) => {
        attachmentsBySource.set(
          buildSourceKey({ modelKey, documentId: String(document._id) }),
          collectAttachments(document, attachmentFields)
        );
      });
    })
  );

  return attachmentsBySource;
};

module.exports = { buildSourceKey, resolveSourceAttachments };