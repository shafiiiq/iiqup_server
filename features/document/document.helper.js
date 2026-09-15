const equipmentModel = require('../equipment/equipment.model');
const operatorModel = require('#features/user/operator/operator.model');
const mechanicModel = require('#features/user/mechanic/mechanic.model');
const staffModel = require('#features/user/staff/staff.model');
const { putObject, getObjectUrl } = require('#core/s3/s3.config');

const formatDate = (date) => {
  if (!date) return null;

  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split('-');
    return `${day}-${month}-${year}`;
  }

  const parsedDate = date instanceof Date ? date : new Date(date + 'T00:00:00');
  if (isNaN(parsedDate.getTime())) return null;

  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
  const day = String(parsedDate.getDate()).padStart(2, '0');

  return `${day}-${month}-${year}`;
};

const formatTimestampForFilename = () => {
  const now = new Date();

  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear().toString().slice(-2);

  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const meridiem = hours >= 12 ? 'pm' : 'am';
  hours = String(hours % 12 || 12).padStart(2, '0');

  return `${day}-${month}-${year}-${hours}${minutes}${meridiem}`;
};

const resolveSourceAndBuildS3Key = async (sourceId, sourceType, documentType, finalFilename) => {
  switch (sourceType) {
    case 'equipment': {
      const sourceData = await equipmentModel.findById(sourceId);
      if (!sourceData) throw new Error('Equipment not found');
      return {
        sourceData,
        sourceModel: 'Equipment Model',
        s3Key: `equipment-documents/${sourceData.regNo}/${documentType}/${finalFilename}`,
      };
    }
    case 'operator': {
      const sourceData = await operatorModel.findById(sourceId);
      if (!sourceData) throw new Error('Operator not found');
      return {
        sourceData,
        sourceModel: 'Operator Model',
        s3Key: `operator-documents/${sourceData.qatarId}/${documentType}/${finalFilename}`,
      };
    }
    case 'mechanic': {
      const sourceData = await mechanicModel.findById(sourceId);
      if (!sourceData) throw new Error('Mechanic not found');
      return {
        sourceData,
        sourceModel: 'Mechanic Model',
        s3Key: `mechanic-documents/${sourceData.email}/${sourceData._id}/${documentType}/${finalFilename}`,
      };
    }
    case 'staff': {
      const sourceData = await staffModel.findById(sourceId);
      if (!sourceData) throw new Error('Staff member not found');
      return {
        sourceData,
        sourceModel: 'Staff Model',
        s3Key: `staff-documents/${sourceData.email}/${sourceData._id}/${documentType}/${finalFilename}`,
      };
    }
    default:
      throw new Error('Invalid source type');
  }
};

const resolveSourceDisplayName = (sourceType, sourceData) => {
  if (sourceType === 'equipment') return sourceData.regNo;
  if (sourceType === 'operator' || sourceType === 'mechanic' || sourceType === 'staff') return sourceData.name;
  return '';
};

const downloadPdfBufferFromS3 = async (s3Key) => {
  try {
    const signedUrl = await getObjectUrl(s3Key, false);
    const response = await fetch(signedUrl);
    if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    throw new Error(`[DocumentHelper] downloadPdfBufferFromS3: ${error.message}`, { cause: error });
  }
};

const uploadPdfBytesToS3 = async (pdfBytes, s3Key, mimeType = 'application/pdf') => {
  try {
    const uploadUrl = await putObject('merged.pdf', s3Key, mimeType);
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: pdfBytes,
      headers: { 'Content-Type': mimeType },
    });
    if (!uploadResponse.ok) throw new Error(`S3 upload failed with status: ${uploadResponse.status}`);
    return uploadUrl;
  } catch (error) {
    throw new Error(`[DocumentHelper] uploadPdfBytesToS3: ${error.message}`, { cause: error });
  }
};

module.exports = {
  formatDate,
  formatTimestampForFilename,
  resolveSourceAndBuildS3Key,
  resolveSourceDisplayName,
  downloadPdfBufferFromS3,
  uploadPdfBytesToS3,
};