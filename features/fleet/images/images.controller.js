const logger = require('#shared/logger/logger');
const HTTP = require('#shared/response/response.status');
const { respond } = require('#shared/response/response.respond');
const imagesService = require('./images.service');
const { MAX_BULK_REG_NOS } = require('./images.constant');

const getEquipmentImages = async (req, res) => {
  try {
    const { regNo } = req.params;
    if (!regNo) {
      return respond(res, { status: HTTP.BAD_REQUEST, success: false, message: 'Equipment regNo is required' });
    }

    const result = await imagesService.getImages(regNo);
    respond(res, result);
  } catch (error) {
    logger.error('[ImagesController] getEquipmentImages:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, success: false, message: error.message });
  }
};

const addEquipmentImage = async (req, res) => {
  try {
    const { equipmentNo, files } = req.body;

    if (!equipmentNo) {
      return respond(res, { status: HTTP.BAD_REQUEST, success: false, message: 'Equipment number is required' });
    }
    if (!files?.length) {
      return respond(res, { status: HTTP.BAD_REQUEST, success: false, message: 'At least one file is required' });
    }

    const result = await imagesService.addImages(equipmentNo, files);
    respond(res, result);
  } catch (error) {
    logger.error('[ImagesController] addEquipmentImage:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, success: false, message: error.message });
  }
};

const getBulkEquipmentImages = async (req, res) => {
  try {
    const { regNos } = req.body;

    if (!Array.isArray(regNos) || regNos.length === 0) {
      return respond(res, { status: HTTP.BAD_REQUEST, success: false, message: 'Array of equipment regNos is required' });
    }
    if (regNos.length > MAX_BULK_REG_NOS) {
      return respond(res, {
        status: HTTP.BAD_REQUEST,
        success: false,
        message: `Maximum ${MAX_BULK_REG_NOS} equipment regNos allowed per request`,
      });
    }

    const result = await imagesService.getBulkImages(regNos);
    respond(res, result);
  } catch (error) {
    logger.error('[ImagesController] getBulkEquipmentImages:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, success: false, message: error.message });
  }
};

const deleteEquipmentImage = async (req, res) => {
  try {
    const { equipmentNo, path } = req.body;
    if (!equipmentNo || !path) {
      return respond(res, { status: HTTP.BAD_REQUEST, success: false, message: 'equipmentNo and path are required' });
    }
    respond(res, await imagesService.removeImage(equipmentNo, path));
  } catch (error) {
    logger.error('[ImagesController] deleteEquipmentImage:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, success: false, message: error.message });
  }
};

const replaceEquipmentImage = async (req, res) => {
  try {
    const { equipmentNo, path, file } = req.body;
    if (!equipmentNo || !path || !file?.fileName || !file?.mimeType) {
      return respond(res, { status: HTTP.BAD_REQUEST, success: false, message: 'equipmentNo, path and file are required' });
    }
    respond(res, await imagesService.replaceImage(equipmentNo, path, file));
  } catch (error) {
    logger.error('[ImagesController] replaceEquipmentImage:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, success: false, message: error.message });
  }
};

const reorderEquipmentImages = async (req, res) => {
  try {
    const { equipmentNo, paths } = req.body;
    if (!equipmentNo || !Array.isArray(paths) || !paths.length) {
      return respond(res, { status: HTTP.BAD_REQUEST, success: false, message: 'equipmentNo and paths are required' });
    }
    respond(res, await imagesService.reorderImages(equipmentNo, paths));
  } catch (error) {
    logger.error('[ImagesController] reorderEquipmentImages:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, success: false, message: error.message });
  }
};

module.exports = {
  deleteEquipmentImage,
  replaceEquipmentImage,
  reorderEquipmentImages,
  getEquipmentImages,
  addEquipmentImage,
  getBulkEquipmentImages,
};
