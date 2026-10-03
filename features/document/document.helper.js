const mongoose = require('mongoose');
const equipmentModel = require('../equipment/equipment.model');
const operatorModel = require('#features/user/operator/operator.model');
const mechanicModel = require('#features/user/mechanic/mechanic.model');
const staffModel = require('#features/user/staff/staff.model');
const { putObject, getObjectUrl } = require('#core/s3/s3.config');

const DOCUMENT_UPLOAD_FEATURE = 'documents';
const SUPPORTED_SOURCE_TYPES = ['equipment', 'operator', 'mechanic', 'staff'];
const RENEWAL_STATUS = { NONE: 'none', RENEWED: 'renewed', EXPIRED: 'expired' };

const sourceModelBySourceType = {
  equipment: equipmentModel,
  operator: operatorModel,
  mechanic: mechanicModel,
  staff: staffModel,
};

const findSourceEntity = async (sourceType, sourceId) => {
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
  createdAt: documentItem.createdAt,
  updatedAt: documentItem.updatedAt,
  fileUrl: await getObjectUrl(documentItem.s3Key, false),
});

module.exports = {
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