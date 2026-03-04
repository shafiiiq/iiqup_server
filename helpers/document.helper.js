const equipmentModel = require('../models/equipment.model');
const operatorModel  = require('../models/operator.model');
const mechanicModel  = require('../models/mechanic.model');
const userModel      = require('../models/user.model');
const { putObject, getObjectUrl } = require('../aws/s3.aws');

// ─────────────────────────────────────────────────────────────────────────────
// Date Formatters
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formats a date value into DD-MM-YYYY string.
 * @param {string|Date|null} date
 * @returns {string|null}
 */
const formatDate = (date) => {
  if (!date) return null;

  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split('-');
    return `${day}-${month}-${year}`;
  }

  const dateObj = date instanceof Date ? date : new Date(date + 'T00:00:00');
  if (isNaN(dateObj.getTime())) return null;

  const year  = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day   = String(dateObj.getDate()).padStart(2, '0');

  return `${day}-${month}-${year}`;
};

/**
 * Returns a timestamp string formatted as DD-MM-YY-HHMMam/pm.
 * @returns {string}
 */
const formatDateTime = () => {
  const now = new Date();

  const day   = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year  = now.getFullYear().toString().slice(-2);

  let hours      = now.getHours();
  const minutes  = String(now.getMinutes()).padStart(2, '0');
  const ampm     = hours >= 12 ? 'pm' : 'am';

  hours = hours % 12 || 12;
  hours = String(hours).padStart(2, '0');

  return `${day}-${month}-${year}-${hours}${minutes}${ampm}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// Source Resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Looks up the source document and builds the S3 key for a given file.
 * @param {string} sourceId
 * @param {string} sourceType  'equipment' | 'operator' | 'mechanic' | 'office-staff'
 * @param {string} documentType
 * @param {string} finalFilename
 * @returns {Promise<{ sourceData: object, s3Key: string, sourceModel: string }>}
 */
const getSourceDetailsAndKey = async (sourceId, sourceType, documentType, finalFilename) => {
  let sourceData  = null;
  let s3Key       = '';
  let sourceModel = '';

  switch (sourceType) {
    case 'equipment':
      sourceData = await equipmentModel.findById(sourceId);
      if (!sourceData) throw new Error('Equipment not found');
      s3Key       = `equipment-documents/${sourceData.regNo}/${documentType}/${finalFilename}`;
      sourceModel = 'Equipment Model';
      break;

    case 'operator':
      sourceData = await operatorModel.findById(sourceId);
      if (!sourceData) throw new Error('Operator not found');
      s3Key       = `operator-documents/${sourceData.qatarId}/${documentType}/${finalFilename}`;
      sourceModel = 'Operator Model';
      break;

    case 'mechanic':
      sourceData = await mechanicModel.findById(sourceId);
      if (!sourceData) throw new Error('Mechanic not found');
      s3Key       = `mechanic-documents/${sourceData.email}/${sourceData._id}/${documentType}/${finalFilename}`;
      sourceModel = 'Mechanic Model';
      break;

    case 'office-staff':
      sourceData = await userModel.findById(sourceId);
      if (!sourceData) throw new Error('Office staff not found');
      s3Key       = `office-documents/${sourceData.email}/${sourceData._id}/${documentType}/${finalFilename}`;
      sourceModel = 'Office Model';
      break;

    default:
      throw new Error('Invalid source type');
  }

  return { sourceData, s3Key, sourceModel };
};

/**
 * Resolves a human-readable identifier for a source document.
 * @param {string} sourceType
 * @param {object} sourceData
 * @returns {string}
 */
const resolveSourceIdentifier = (sourceType, sourceData) => {
  switch (sourceType) {
    case 'equipment':  return sourceData.regNo;
    case 'operator':
    case 'mechanic':
    case 'office-staff': return sourceData.name;
    default:           return '';
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// S3 Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Downloads a PDF from S3 and returns it as a Buffer.
 * @param {string} s3Key
 * @returns {Promise<Buffer>}
 */
const downloadPDFFromS3 = async (s3Key) => {
  try {
    const url      = await getObjectUrl(s3Key, false);
    const response = await fetch(url);

    if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.status}`);

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('[DocumentHelper] downloadPDFFromS3:', error);
    throw new Error(`Failed to download PDF: ${error.message}`);
  }
};

/**
 * Uploads raw PDF bytes to S3 via a presigned PUT URL.
 * @param {Uint8Array|Buffer} pdfBytes
 * @param {string}            s3Key
 * @param {string}            mimeType
 * @returns {Promise<string>} The presigned upload URL.
 */
const uploadPDFToS3 = async (pdfBytes, s3Key, mimeType = 'application/pdf') => {
  try {
    const uploadUrl      = await putObject('merged.pdf', s3Key, mimeType);
    const uploadResponse = await fetch(uploadUrl, {
      method:  'PUT',
      body:    pdfBytes,
      headers: { 'Content-Type': mimeType }
    });

    if (!uploadResponse.ok) throw new Error(`S3 upload failed with status: ${uploadResponse.status}`);

    return uploadUrl;
  } catch (error) {
    console.error('[DocumentHelper] uploadPDFToS3:', error);
    throw new Error(`Failed to upload PDF: ${error.message}`);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  formatDate,
  formatDateTime,
  getSourceDetailsAndKey,
  resolveSourceIdentifier,
  downloadPDFFromS3,
  uploadPDFToS3
};