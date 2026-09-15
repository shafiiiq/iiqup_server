const path = require('path');
const logger = require('#shared/logger/logger');
const HTTP = require('#shared/response/response.status');
const { putObject } = require('#core/s3/s3.config');
const EquipmentImageModel = require('./images.model');
const { normaliseImages, buildS3Key } = require('./images.helper');

const fetchImageMap = async (regNos) => {
  const records = await EquipmentImageModel.find({ equipmentNo: { $in: regNos } }).lean();
  return Object.fromEntries(
    records.map((record) => [record.equipmentNo, normaliseImages(record.images || [])])
  );
};

const uploadOneImage = async (equipmentNo, file, index) => {
  const label = file.label || 'Unlabeled';
  const ext = path.extname(file.fileName);
  const s3Key = buildS3Key(equipmentNo, file.fileName, index, ext);
  const uploadUrl = await putObject(file.fileName, s3Key, file.mimeType);

  const saveResult = await addImage(equipmentNo, s3Key, label, path.basename(s3Key), file.mimeType);
  if (!saveResult.success) {
    throw new Error(`Failed to save image metadata: ${saveResult.message}`);
  }

  return {
    fileName: path.basename(s3Key),
    originalName: file.fileName,
    filePath: s3Key,
    mimeType: file.mimeType,
    type: file.mimeType.startsWith('video/') ? 'video' : 'photo',
    uploadUrl,
    uploadDate: new Date(),
    label,
    dbSaveResult: saveResult,
  };
};

const addImage = async (equipmentNo, imagePath, imageLabel, fileName, mimeType) => {
  try {
    if (!imagePath || !imageLabel) {
      return { status: HTTP.BAD_REQUEST, success: false, message: 'Image path and label are required' };
    }

    const equipmentNoStr = String(equipmentNo);

    const equipment = await EquipmentImageModel.findOneAndUpdate(
      { equipmentNo: equipmentNoStr },
      {
        $push: { images: { path: imagePath, label: imageLabel, fileName, mimeType } },
        $set: { updatedAt: new Date() },
        $setOnInsert: { equipmentName: `Equipment ${equipmentNoStr}`, createdAt: new Date() },
      },
      { upsert: true, new: true, runValidators: true }
    );

    const isNewEquipment = equipment.images.length === 1;

    return {
      status: HTTP.OK,
      success: true,
      message: isNewEquipment
        ? 'Equipment created with image successfully'
        : 'Image added to existing equipment successfully',
      data: {
        equipmentNo: equipmentNoStr,
        equipmentName: equipment.equipmentName,
        totalImages: equipment.images.length,
        imagePath,
        imageLabel,
        fileName,
        isNewEquipment,
      },
    };
  } catch (err) {
    logger.error('[ImagesService] addImage:', err);
    const isValidationError = err.name === 'ValidationError';
    return {
      status: isValidationError ? HTTP.BAD_REQUEST : HTTP.INTERNAL_SERVER_ERROR,
      success: false,
      message: isValidationError ? `Validation error: ${err.message}` : 'Failed to add equipment image',
      error: err.message,
    };
  }
};

const addImages = async (equipmentNo, files) => {
  try {
    const uploadData = await Promise.all(files.map((file, index) => uploadOneImage(equipmentNo, file, index)));

    return {
      status: HTTP.OK,
      success: true,
      message: 'Pre-signed URLs generated and metadata saved',
      data: { uploadData },
    };
  } catch (err) {
    logger.error('[ImagesService] addImages:', err);
    return { status: err.status || HTTP.INTERNAL_SERVER_ERROR, success: false, message: err.message };
  }
};

const getImages = async (regNo) => {
  try {
    const equipment = await EquipmentImageModel.findOne({ equipmentNo: regNo });
    if (!equipment) {
      return { status: HTTP.NOT_FOUND, success: false, message: 'Equipment not found' };
    }

    const result = equipment.toObject();
    result.images = normaliseImages(result.images || []);

    return { status: HTTP.OK, success: true, message: 'Equipment details retrieved successfully', data: result };
  } catch (err) {
    logger.error('[ImagesService] getImages:', err);
    return {
      status: HTTP.INTERNAL_SERVER_ERROR,
      success: false,
      message: 'Failed to retrieve equipment details',
      error: err.message,
    };
  }
};

const getBulkImages = async (regNos) => {
  try {
    const imageMap = await fetchImageMap(regNos);

    const result = Object.fromEntries(regNos.map((regNo) => [regNo, { success: false, images: [] }]));
    Object.keys(imageMap).forEach((regNo) => {
      result[regNo] = { success: true, images: imageMap[regNo] };
    });

    return {
      status: HTTP.OK,
      success: true,
      message: 'Bulk equipment images retrieved successfully',
      data: result,
      totalRequested: regNos.length,
      totalFound: Object.values(result).filter((r) => r.success).length,
    };
  } catch (err) {
    logger.error('[ImagesService] getBulkImages:', err);
    return {
      status: HTTP.INTERNAL_SERVER_ERROR,
      success: false,
      message: 'Failed to retrieve bulk equipment images',
      error: err.message,
    };
  }
};

module.exports = {
  addImage,
  addImages,
  getImages,
  getBulkImages,
  fetchImageMap,
};
