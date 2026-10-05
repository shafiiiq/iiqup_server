const mongoose = require('mongoose');
const equipmentModel = require('../equipment/equipment.model');
const operatorModel = require('#features/user/operator/operator.model');
const mechanicModel = require('#features/user/mechanic/mechanic.model');
const staffModel = require('#features/user/staff/staff.model');
const { putObject, getObjectUrl } = require('#core/s3/s3.config');

const DOCUMENT_UPLOAD_FEATURE = 'documents';
const SUPPORTED_SOURCE_TYPES = ['equipment', 'operator', 'mechanic', 'staff', 'root'];
const DOCUMENT_AREAS = ['all', 'renewed', 'expired', 'source'];
const RENEWAL_STATUS = { NONE: 'none', RENEWED: 'renewed', EXPIRED: 'expired' };

const sourceModelBySourceType = {
  equipment: equipmentModel,
  operator: operatorModel,
  mechanic: mechanicModel,
  staff: staffModel,
};

const decodeLayerId = (layerId) => {
  try {
    return decodeURIComponent(
      String(layerId).replace(/~([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    );
  } catch {
    return String(layerId);
  }
};

const prettifyLayerLabel = (layerId) => {
  const nodeKey = decodeLayerId(layerId);
  if (nodeKey === 'root') return 'Root';
  if (nodeKey === 'equipments') return 'Equipments';
  if (nodeKey === 'users') return 'Users';
  return nodeKey.replace(/^equipment-category-/, 'Equipments / ').replace(/^user-section-/, 'Users / ');
};

const findSourceEntity = async (sourceType, sourceId) => {
  if (sourceType === 'root') {
    return typeof sourceId === 'string' && sourceId && sourceId.length <= 400
      ? { _id: sourceId, name: prettifyLayerLabel(sourceId) }
      : null;
  }
  const sourceModel = sourceModelBySourceType[sourceType];
  if (!sourceModel || !mongoose.isValidObjectId(sourceId)) return null;
  return sourceModel.findById(sourceId);
};

const buildDocumentKeyPrefix = (sourceType, sourceId) => `documents/${sourceType}/${sourceId}`;

const stripFileExtension = (fileName) => fileName.replace(/\.[^/.]+$/, '');

const isPdfMimeType = (mimeType) => (mimeType || '').toLowerCase().includes('pdf');

const isValidDateInput = (value) => !value || !Number.isNaN(new Date(value).getTime());

const toDateOrNull = (value) => (value ? new Date(value) : null);

const downloadPdfBufferFromS3 = async (s3Key) => {
  const signedUrl = await getObjectUrl(s3Key, false);
  const response = await fetch(signedUrl);
  if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
};

const uploadPdfBytesToS3 = async (pdfBytes, s3Key) => {
  const uploadUrl = await putObject('document.pdf', s3Key, 'application/pdf');
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    body: pdfBytes,
    headers: { 'Content-Type': 'application/pdf' },
  });
  if (!uploadResponse.ok) throw new Error(`S3 upload failed with status: ${uploadResponse.status}`);
};

const serializeDocument = async (documentItem) => ({
  _id: documentItem._id.toString(),
  sourceType: documentItem.sourceType,
  sourceId: documentItem.sourceId,
  displayName: documentItem.displayName,
  originalFileName: documentItem.originalFileName,
  s3Key: documentItem.s3Key,
  mimeType: documentItem.mimeType,
  fileSize: documentItem.fileSize,
  issueDate: documentItem.issueDate,
  expiryDate: documentItem.expiryDate,
  renewalStatus: documentItem.renewalStatus,
  renewedFromDocumentId: documentItem.renewedFromDocumentId,
  folderId: documentItem.folderId ? documentItem.folderId.toString() : null,
  area: documentItem.area || 'all',
  deletedAt: documentItem.deletedAt || null,
  trashedFromPath: documentItem.trashedFromPath || null,
  createdAt: documentItem.createdAt,
  updatedAt: documentItem.updatedAt,
  fileUrl: await getObjectUrl(documentItem.s3Key, false),
});

const ROOT_PATH_LABEL = 'All Documents';
const SOURCE_TYPE_LABELS = { equipment: 'Equipment', operator: 'Operator', mechanic: 'Mechanic', staff: 'Office', root: 'Root' };

const resolveSourceLabel = (sourceType, sourceEntity) => {
  if (sourceType === 'equipment') return [sourceEntity.regNo, sourceEntity.machine].filter(Boolean).join(' - ');
  return sourceEntity.name || sourceEntity.email || String(sourceEntity._id);
};

const MIME_TYPE_BY_EXTENSION = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  txt: 'text/plain',
  csv: 'text/csv',
  json: 'application/json',
  zip: 'application/zip',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

const resolveMimeTypeFromFileName = (fileName) => {
  const extension = String(fileName).split('.').pop().toLowerCase();
  return MIME_TYPE_BY_EXTENSION[extension] || 'application/octet-stream';
};

const normalizeArea = (area, sourceType) => {
  if (sourceType === 'root') return 'source';
  return DOCUMENT_AREAS.includes(area) ? area : 'all';
};

const buildAreaFilter = (area) => (area === 'all' ? { $in: ['all', null] } : area);

const buildPreviewKey = (s3Key) => `previews/${s3Key}.pdf`;

const uploadBytesToS3 = async (bytes, s3Key, mimeType) => {
  const uploadUrl = await putObject('upload', s3Key, mimeType);
  const uploadResponse = await fetch(uploadUrl, { method: 'PUT', body: bytes, headers: { 'Content-Type': mimeType } });
  if (!uploadResponse.ok) throw new Error(`S3 upload failed with status: ${uploadResponse.status}`);
};

module.exports = {
  normalizeArea,
  buildAreaFilter,
  buildPreviewKey,
  uploadBytesToS3,
  ROOT_PATH_LABEL,
  SOURCE_TYPE_LABELS,
  resolveSourceLabel,
  resolveMimeTypeFromFileName,
  DOCUMENT_UPLOAD_FEATURE,
  SUPPORTED_SOURCE_TYPES,
  RENEWAL_STATUS,
  findSourceEntity,
  buildDocumentKeyPrefix,
  stripFileExtension,
  isPdfMimeType,
  isValidDateInput,
  toDateOrNull,
  downloadPdfBufferFromS3,
  uploadPdfBytesToS3,
  serializeDocument,
};