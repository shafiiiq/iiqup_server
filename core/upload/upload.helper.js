const { v4: uuidv4 } = require('uuid');
const { MIN_PART_SIZE } = require("./upload.config");

const sanitizeFileName = (name) => name.replace(/[^a-zA-Z0-9.\-_]/g, '_');

const buildS3Key = (feature, keyPrefix, fileName) => {
  const safeName = sanitizeFileName(fileName);
  const prefix = keyPrefix || `uploads/${feature}`;
  return `${prefix}/${Date.now()}-${uuidv4()}-${safeName}`;
};

const calculatePartPlan = (fileSize) => {
  const partSize = MIN_PART_SIZE;
  const totalParts = Math.max(1, Math.ceil(fileSize / partSize));
  return { partSize, totalParts };
};

module.exports = {
    sanitizeFileName,
    buildS3Key,
    calculatePartPlan
}