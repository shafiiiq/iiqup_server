const logger = require('../logger/logger');
const HTTP = require('../constants/httpStatus.constant');
const { sendSuccess, sendError } = require('../response/response.util');
const UploadService = require('./upload.service');

const initiateUpload = async (req, res) => {
  try {
    const { feature, context, entityId, keyPrefix, fileName, mimeType, fileSize } = req.body;

    const result = await UploadService.initiateUpload({
      feature,
      context,
      entityId,
      keyPrefix,
      fileName,
      mimeType,
      fileSize,
      uploadedBy: req.userId,
    });

    sendSuccess(res, { status: HTTP.CREATED, message: 'Upload session created', data: result });
  } catch (error) {
    logger.error('[UploadController] initiateUpload:', error);
    sendError(res, {
      status: error.status || HTTP.INTERNAL_SERVER_ERROR,
      message: error.message || 'Failed to initiate upload',
    });
  }
};

const getPartUrls = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { partNumbers } = req.body;

    const result = await UploadService.getPartUrls({
      sessionId,
      uploadedBy: req.userId,
      partNumbers,
    });

    sendSuccess(res, { status: HTTP.OK, message: 'Part URLs generated', data: result });
  } catch (error) {
    logger.error('[UploadController] getPartUrls:', error);
    sendError(res, {
      status: error.status || HTTP.INTERNAL_SERVER_ERROR,
      message: error.message || 'Failed to generate part URLs',
    });
  }
};

const acknowledgePart = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { partNumber, etag, size } = req.body;

    const result = await UploadService.acknowledgePart({
      sessionId,
      uploadedBy: req.userId,
      partNumber,
      etag,
      size,
    });

    sendSuccess(res, { status: HTTP.OK, message: 'Part acknowledged', data: result });
  } catch (error) {
    logger.error('[UploadController] acknowledgePart:', error);
    sendError(res, {
      status: error.status || HTTP.INTERNAL_SERVER_ERROR,
      message: error.message || 'Failed to acknowledge part',
    });
  }
};

const completeUpload = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { parts } = req.body;

    const result = await UploadService.completeUpload({
      sessionId,
      uploadedBy: req.userId,
      parts,
    });

    sendSuccess(res, { status: HTTP.OK, message: 'Upload completed successfully', data: result });
  } catch (error) {
    logger.error('[UploadController] completeUpload:', error);
    sendError(res, {
      status: error.status || HTTP.INTERNAL_SERVER_ERROR,
      message: error.message || 'Failed to complete upload',
    });
  }
};

const abortUpload = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const result = await UploadService.abortUpload({ sessionId, uploadedBy: req.userId });
    sendSuccess(res, { status: HTTP.OK, message: 'Upload aborted', data: result });
  } catch (error) {
    logger.error('[UploadController] abortUpload:', error);
    sendError(res, {
      status: error.status || HTTP.INTERNAL_SERVER_ERROR,
      message: error.message || 'Failed to abort upload',
    });
  }
};

const getUploadStatus = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const result = await UploadService.getSessionStatus({ sessionId, uploadedBy: req.userId });
    sendSuccess(res, { status: HTTP.OK, message: 'Upload status retrieved', data: result });
  } catch (error) {
    logger.error('[UploadController] getUploadStatus:', error);
    sendError(res, {
      status: error.status || HTTP.INTERNAL_SERVER_ERROR,
      message: error.message || 'Failed to retrieve upload status',
    });
  }
};

module.exports = {
  initiateUpload,
  getPartUrls,
  acknowledgePart,
  completeUpload,
  abortUpload,
  getUploadStatus,
};