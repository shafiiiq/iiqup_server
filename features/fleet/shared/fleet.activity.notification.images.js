const logger = require('#shared/logger/logger');
const { fetchImageMap } = require('../images/images.service');
const {
  FLEET_ACTIVITY_IMAGE_MODEL_KEYS,
  FLEET_ACTIVITY_IMAGE_LIMIT,
} = require('./fleet.activity.notification.constant');

const IMAGE_FILE_PATTERN = /\.(jpe?g|png|webp|heic)$/i;

const readImageRegNos = (modelKey, record) => {
  if (!FLEET_ACTIVITY_IMAGE_MODEL_KEYS.includes(modelKey)) return [];
  return [...new Set([record.regNo, record.replacedEquipmentRegNo].filter(Boolean))];
};

const pickImagePaths = (regNos, imageMap) => {
  const perEquipmentLimit = regNos.length > 1 ? 1 : FLEET_ACTIVITY_IMAGE_LIMIT;
  return regNos
    .flatMap((regNo) =>
      (imageMap[regNo] || [])
        .map((image) => image.key)
        .filter((key) => IMAGE_FILE_PATTERN.test(key))
        .slice(0, perEquipmentLimit)
    )
    .slice(0, FLEET_ACTIVITY_IMAGE_LIMIT);
};

const collectFleetActivityImagePaths = async (modelKey, record) => {
  const regNos = readImageRegNos(modelKey, record);
  if (regNos.length === 0) return [];

  try {
    return pickImagePaths(regNos, await fetchImageMap(regNos));
  } catch (error) {
    logger.warn(`[fleet.activity.notification.images] collect failed: ${error.message}`);
    return [];
  }
};

module.exports = { collectFleetActivityImagePaths };