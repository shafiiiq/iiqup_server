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

module.exports = {
  getEquipmentImages,
  addEquipmentImage,
  getBulkEquipmentImages,
};
