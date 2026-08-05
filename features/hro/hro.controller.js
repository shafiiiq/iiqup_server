const logger = require('../../shared/logger/logger');

const HTTP = require('../../shared/constants/httpStatus.constant.js');
const { sendSuccess, sendError } = require('../../shared/response/response.util');
const hireOrderService = require('./hro.service');
const { sendLPOViaEmail } = require('../lpo/lpo.gmail');

const addHireOrder = async (req, res) => {
  try {
    const hireOrderData = req.body;

    if (
      !hireOrderData.hireOrderRef ||
      !hireOrderData.date ||
      !hireOrderData.company?.vendor ||
      !hireOrderData.company?.attention ||
      !hireOrderData.company?.designation
    ) {
      return sendError(res, {
        success: false,
        message: 'Missing required hire order fields',
      });
    }

    if (
      !hireOrderData.items ||
      !Array.isArray(hireOrderData.items) ||
      hireOrderData.items.length === 0
    ) {
      return sendError(res, {
        success: false,
        message: 'items array is required and cannot be empty',
      });
    }

    if (
      !hireOrderData.columns ||
      !Array.isArray(hireOrderData.columns) ||
      hireOrderData.columns.length === 0
    ) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'columns array is required' });
    }

    const hireOrder = await hireOrderService.createHireOrder(hireOrderData);

    sendSuccess(res, {
      success: true,
      message: 'Hire order created successfully',
      data: hireOrder,
    });
  } catch (error) {
    logger.error('[HireOrder] addHireOrder:', error);
    sendError(res, { success: false, message: error.message });
  }
};

const getAllHireOrders = async (req, res) => {
  try {
    const result = await hireOrderService.getAllHireOrders(req.pagination);
    sendSuccess(res, {
      success: true,
      message: 'Hire orders retrieved successfully',
      data: result.data,
      pagination: result.pagination,
      count: result.data.length,
    });
  } catch (error) {
    logger.error('[HireOrder] getAllHireOrders:', error);
    sendError(res, { success: false, message: error.message });
  }
};

const getHireOrderByRef = async (req, res) => {
  try {
    const refNo = req.params.refNo;
    if (!refNo)
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'Reference number is required' });

    const hireOrder = await hireOrderService.getHireOrderByRef(
      decodeURIComponent(refNo)
    );
    sendSuccess(res, {
      success: true,
      message: 'Hire order retrieved successfully',
      data: hireOrder,
    });
  } catch (error) {
    logger.error('[HireOrder] getHireOrderByRef:', error);
    const status = error.message === 'Hire order not found' ? HTTP.NOT_FOUND : HTTP.INTERNAL_SERVER_ERROR;
    sendError(res, { success: false, message: error.message });
  }
};

const getLatestHireOrderRef = async (req, res) => {
  try {
    const latestRef = await hireOrderService.getLatestHireOrderRef();
    sendSuccess(res, {
      success: true,
      message: 'Latest hire order reference retrieved successfully',
      data: { latestRef: latestRef || 'No hire order found' },
    });
  } catch (error) {
    logger.error('[HireOrder] getLatestHireOrderRef:', error);
    sendError(res, { success: false, message: error.message });
  }
};

const updateHireOrder = async (req, res) => {
  try {
    const { refNo } = req.params;
    const updateData = req.body;
    if (!refNo)
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'Reference number is required' });

    const hireOrder = await hireOrderService.updateHireOrder(
      decodeURIComponent(refNo),
      updateData
    );
    sendSuccess(res, {
      success: true,
      message: 'Hire order updated successfully',
      data: hireOrder,
    });
  } catch (error) {
    logger.error('[HireOrder] updateHireOrder:', error);
    const status = error.message === 'Hire order not found' ? HTTP.NOT_FOUND : HTTP.INTERNAL_SERVER_ERROR;
    sendError(res, { success: false, message: error.message });
  }
};

const deleteHireOrder = async (req, res) => {
  try {
    const { refNo } = req.params;
    if (!refNo)
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'Reference number is required' });

    const hireOrder = await hireOrderService.deleteHireOrder(
      decodeURIComponent(refNo)
    );
    sendSuccess(res, {
      success: true,
      message: 'Hire order deleted successfully',
      data: hireOrder,
    });
  } catch (error) {
    logger.error('[HireOrder] deleteHireOrder:', error);
    const status = error.message === 'Hire order not found' ? HTTP.NOT_FOUND : HTTP.INTERNAL_SERVER_ERROR;
    sendError(res, { success: false, message: error.message });
  }
};

const uploadHireOrder = async (req, res) => {
  try {
    const { hireOrderRef, uploadedBy, description } = req.body;
    if (!hireOrderRef)
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'hireOrderRef is required' });

    const hireOrder = await hireOrderService.uploadHireOrder(
      hireOrderRef,
      uploadedBy || 'WORKSHOP_MANAGER',
      description || 'Hire order document generated from system'
    );
    sendSuccess(res, {
      success: true,
      message: 'Hire order sent for approval',
      data: hireOrder,
    });
  } catch (error) {
    logger.error('[HireOrder] uploadHireOrder:', error);
    sendError(res, { success: false, message: error.message });
  }
};

const getPendingSignatures = async (req, res) => {
  try {
    const { uniqueCode } = req.body;
    if (!uniqueCode)
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'uniqueCode is required' });

    const pending = await hireOrderService.getPendingSignatures(uniqueCode);
    sendSuccess(res, {
      success: true,
      message: 'Pending hire order signatures retrieved successfully',
      data: pending,
      count: pending.length,
    });
  } catch (error) {
    logger.error('[HireOrder] getPendingSignatures:', error);
    sendError(res, { success: false, message: error.message });
  }
};

const getSignedByUser = async (req, res) => {
  try {
    const { uniqueCode } = req.body;
    if (!uniqueCode)
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'uniqueCode is required' });

    const signed = await hireOrderService.getSignedByUser(uniqueCode);
    sendSuccess(res, {
      success: true,
      message: 'Signed hire orders retrieved successfully',
      data: signed,
      count: signed.length,
    });
  } catch (error) {
    logger.error('[HireOrder] getSignedByUser:', error);
    sendError(res, { success: false, message: error.message });
  }
};

const signHireOrder = async (req, res) => {
  try {
    const { refNo } = req.params;
    const { uniqueCode, signedDate, signedFrom } = req.body;
    if (!uniqueCode || !signedDate || !signedFrom)
      return sendError(res, {
        success: false,
        message: 'uniqueCode, signedDate, and signedFrom are required',
      });

    const result = await hireOrderService.signHireOrder(
      decodeURIComponent(refNo),
      { uniqueCode, signedDate, signedFrom }
    );
    res
      .status(HTTP.OK)
      .json({ success: true, message: result.message, data: result.data });
  } catch (error) {
    logger.error('[HireOrder] signHireOrder:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message || 'Signing failed' });
  }
};

const sendHireOrderViaEmail = async (req, res) => {
  try {
    const pdfFile = req.files?.pdf?.[0];
    const attachments = req.files?.attachments || [];
    const emails = JSON.parse(req.body.emails || '[]');
    const recipientName = req.body.recipientName || '';
    const vendorName = req.body.vendorName || '';
    const equipment = req.body.equipment || 'Hire Order';
    const hireOrderRef = req.body.hireOrderRef || '';

    const attachmentsList = [];
    if (pdfFile) attachmentsList.push(pdfFile);
    attachments.forEach((file) => attachmentsList.push(file));

    await sendLPOViaEmail(
      emails,
      vendorName,
      recipientName,
      attachmentsList,
      equipment
    );

    sendSuccess(res, {
      success: true,
      message: 'Hire order sent successfully',
      data: { hireOrderRef },
    });
  } catch (error) {
    logger.error('[HireOrder] sendHireOrderViaEmail:', error);
    sendError(res, { success: false, message: error.message });
  }
};

module.exports = {
  addHireOrder,
  getAllHireOrders,
  getHireOrderByRef,
  getLatestHireOrderRef,
  updateHireOrder,
  deleteHireOrder,
  uploadHireOrder,
  getPendingSignatures,
  getSignedByUser,
  signHireOrder,
  sendHireOrderViaEmail,
};
