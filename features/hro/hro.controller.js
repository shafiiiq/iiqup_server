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
      return res.status(400).json({
        success: false,
        message: 'Missing required hire order fields',
      });
    }

    if (
      !hireOrderData.items ||
      !Array.isArray(hireOrderData.items) ||
      hireOrderData.items.length === 0
    ) {
      return res.status(400).json({
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
        .status(400)
        .json({ success: false, message: 'columns array is required' });
    }

    const hireOrder = await hireOrderService.createHireOrder(hireOrderData);

    res.status(201).json({
      success: true,
      message: 'Hire order created successfully',
      data: hireOrder,
    });
  } catch (error) {
    console.error('[HireOrder] addHireOrder:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAllHireOrders = async (req, res) => {
  try {
    const hireOrders = await hireOrderService.getAllHireOrders();
    res.status(200).json({
      success: true,
      message: 'Hire orders retrieved successfully',
      data: hireOrders,
      count: hireOrders.length,
    });
  } catch (error) {
    console.error('[HireOrder] getAllHireOrders:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getHireOrderByRef = async (req, res) => {
  try {
    const refNo = req.params.refNo;
    if (!refNo)
      return res
        .status(400)
        .json({ success: false, message: 'Reference number is required' });

    const hireOrder = await hireOrderService.getHireOrderByRef(
      decodeURIComponent(refNo)
    );
    res.status(200).json({
      success: true,
      message: 'Hire order retrieved successfully',
      data: hireOrder,
    });
  } catch (error) {
    console.error('[HireOrder] getHireOrderByRef:', error);
    const status = error.message === 'Hire order not found' ? 404 : 500;
    res.status(status).json({ success: false, message: error.message });
  }
};

const getLatestHireOrderRef = async (req, res) => {
  try {
    const latestRef = await hireOrderService.getLatestHireOrderRef();
    res.status(200).json({
      success: true,
      message: 'Latest hire order reference retrieved successfully',
      data: { latestRef: latestRef || 'No hire order found' },
    });
  } catch (error) {
    console.error('[HireOrder] getLatestHireOrderRef:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateHireOrder = async (req, res) => {
  try {
    const { refNo } = req.params;
    const updateData = req.body;
    if (!refNo)
      return res
        .status(400)
        .json({ success: false, message: 'Reference number is required' });

    const hireOrder = await hireOrderService.updateHireOrder(
      decodeURIComponent(refNo),
      updateData
    );
    res.status(200).json({
      success: true,
      message: 'Hire order updated successfully',
      data: hireOrder,
    });
  } catch (error) {
    console.error('[HireOrder] updateHireOrder:', error);
    const status = error.message === 'Hire order not found' ? 404 : 500;
    res.status(status).json({ success: false, message: error.message });
  }
};

const deleteHireOrder = async (req, res) => {
  try {
    const { refNo } = req.params;
    if (!refNo)
      return res
        .status(400)
        .json({ success: false, message: 'Reference number is required' });

    const hireOrder = await hireOrderService.deleteHireOrder(
      decodeURIComponent(refNo)
    );
    res.status(200).json({
      success: true,
      message: 'Hire order deleted successfully',
      data: hireOrder,
    });
  } catch (error) {
    console.error('[HireOrder] deleteHireOrder:', error);
    const status = error.message === 'Hire order not found' ? 404 : 500;
    res.status(status).json({ success: false, message: error.message });
  }
};

const uploadHireOrder = async (req, res) => {
  try {
    const { hireOrderRef, uploadedBy, description } = req.body;
    if (!hireOrderRef)
      return res
        .status(400)
        .json({ success: false, message: 'hireOrderRef is required' });

    const hireOrder = await hireOrderService.uploadHireOrder(
      hireOrderRef,
      uploadedBy || 'WORKSHOP_MANAGER',
      description || 'Hire order document generated from system'
    );
    res.status(200).json({
      success: true,
      message: 'Hire order sent for approval',
      data: hireOrder,
    });
  } catch (error) {
    console.error('[HireOrder] uploadHireOrder:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getPendingSignatures = async (req, res) => {
  try {
    const { uniqueCode } = req.body;
    if (!uniqueCode)
      return res
        .status(400)
        .json({ success: false, message: 'uniqueCode is required' });

    const pending = await hireOrderService.getPendingSignatures(uniqueCode);
    res.status(200).json({
      success: true,
      message: 'Pending hire order signatures retrieved successfully',
      data: pending,
      count: pending.length,
    });
  } catch (error) {
    console.error('[HireOrder] getPendingSignatures:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getSignedByUser = async (req, res) => {
  try {
    const { uniqueCode } = req.body;
    if (!uniqueCode)
      return res
        .status(400)
        .json({ success: false, message: 'uniqueCode is required' });

    const signed = await hireOrderService.getSignedByUser(uniqueCode);
    res.status(200).json({
      success: true,
      message: 'Signed hire orders retrieved successfully',
      data: signed,
      count: signed.length,
    });
  } catch (error) {
    console.error('[HireOrder] getSignedByUser:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const signHireOrder = async (req, res) => {
  try {
    const { refNo } = req.params;
    const { uniqueCode, signedDate, signedFrom } = req.body;
    if (!uniqueCode || !signedDate || !signedFrom)
      return res.status(400).json({
        success: false,
        message: 'uniqueCode, signedDate, and signedFrom are required',
      });

    const result = await hireOrderService.signHireOrder(
      decodeURIComponent(refNo),
      { uniqueCode, signedDate, signedFrom }
    );
    res
      .status(200)
      .json({ success: true, message: result.message, data: result.data });
  } catch (error) {
    console.error('[HireOrder] signHireOrder:', error);
    res
      .status(error.status || 500)
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

    res.status(200).json({
      success: true,
      message: 'Hire order sent successfully',
      data: { hireOrderRef },
    });
  } catch (error) {
    console.error('[HireOrder] sendHireOrderViaEmail:', error);
    res.status(500).json({ success: false, message: error.message });
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
