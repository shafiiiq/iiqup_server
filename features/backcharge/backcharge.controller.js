const logger = require('../../shared/logger/logger');

const HTTP = require('../../shared/constants/httpStatus.constant.js');
const { sendSuccess, sendError } = require('../../shared/response/response.util');
// controllers/backcharge.controller.js
const backchargeService = require('./backcharge.service');
const { sendBackchargeViaEmail } = require('./backcharge.gmail');

// ─────────────────────────────────────────────────────────────────────────────
// Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /get-backcharge-reports
 * Returns all backcharge reports.
 */
const getAllBackchargeReports = async (req, res) => {
  try {
    const reports = await backchargeService.getAllBackchargeReports();

    sendSuccess(res, {
      success: true,
      message: 'Backcharge reports retrieved successfully',
      data: reports,
    });
  } catch (error) {
    logger.error('[Backcharge] getAllBackchargeReports:', error);
    sendError(res, {
      success: false,
      message: 'Error retrieving backcharge reports',
      error: error.message,
    });
  }
};

/**
 * GET /get-backcharge/:id
 * Returns a single backcharge report by MongoDB ID.
 */
const getBackchargeById = async (req, res) => {
  try {
    const report = await backchargeService.getBackchargeById(req.params.id);

    if (!report) {
      return res
        .status(HTTP.NOT_FOUND)
        .json({ success: false, message: 'Backcharge report not found' });
    }

    sendSuccess(res, {
      success: true,
      message: 'Backcharge report retrieved successfully',
      data: report,
    });
  } catch (error) {
    logger.error('[Backcharge] getBackchargeById:', error);
    sendError(res, {
      success: false,
      message: 'Error retrieving backcharge report',
      error: error.message,
    });
  }
};

/**
 * GET /get-backcharge-by-report/:reportNo
 * Returns a single backcharge report by report number.
 */
const getBackchargeByReportNo = async (req, res) => {
  try {
    const report = await backchargeService.getBackchargeByReportNo(
      req.params.reportNo
    );

    if (!report) {
      return res
        .status(HTTP.NOT_FOUND)
        .json({ success: false, message: 'Backcharge report not found' });
    }

    sendSuccess(res, {
      success: true,
      message: 'Backcharge report retrieved successfully',
      data: report,
    });
  } catch (error) {
    logger.error('[Backcharge] getBackchargeByReportNo:', error);
    sendError(res, {
      success: false,
      message: 'Error retrieving backcharge report',
      error: error.message,
    });
  }
};

/**
 * GET /get-backcharge-by-ref/:refNo
 * Returns a single backcharge report by reference number.
 */
const getBackchargeByRefNo = async (req, res) => {
  try {
    const report = await backchargeService.getBackchargeByRefNo(
      req.params.refNo
    );

    if (!report) {
      return res
        .status(HTTP.NOT_FOUND)
        .json({ success: false, message: 'Backcharge report not found' });
    }

    sendSuccess(res, {
      success: true,
      message: 'Backcharge report retrieved successfully',
      data: report,
    });
  } catch (error) {
    logger.error('[Backcharge] getBackchargeByRefNo:', error);
    sendError(res, {
      success: false,
      message: 'Error retrieving backcharge report',
      error: error.message,
    });
  }
};

/**
 * POST /add-backcharge
 * Creates a new backcharge report.
 */
const addBackcharge = async (req, res) => {
  try {
    const { reportNo, equipmentType, plateNo } = req.body;

    if (!reportNo || !equipmentType || !plateNo) {
      return sendError(res, {
        success: false,
        message: 'Report number, equipment type, and plate number are required',
      });
    }

    const existing = await backchargeService.getBackchargeByReportNo(reportNo);
    if (existing) {
      return sendError(res, {
        success: false,
        message: 'Backcharge report with this report number already exists',
      });
    }

    const report = await backchargeService.addBackcharge(req.body);

    sendSuccess(res, {
      success: true,
      message: 'Backcharge report created successfully',
      data: report,
    });
  } catch (error) {
    logger.error('[Backcharge] addBackcharge:', error);
    sendError(res, {
      success: false,
      message: 'Error creating backcharge report',
      error: error.message,
    });
  }
};

/**
 * POST /send-via-email
 * Generates PDF and sends backcharge document to supplier via email.
 */
const sendBackchargeToEmail = async (req, res) => {
  try {
    const { email, recipientName, supplierName, equipment, refNo } = req.body;
    const pdfFile = req.file;

    if (!email || !pdfFile) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'Email and PDF are required' });
    }

    if (refNo) {
      const doc = await backchargeService.getBackchargeByRefNo(refNo);
      if (doc?.supplierCode) {
        await backchargeService.saveSupplierEmail(doc.supplierCode, email);
      }
    }

    const attachment = {
      content: pdfFile.buffer,
      filename: pdfFile.originalname || 'backcharge.pdf',
      mimeType: 'application/pdf',
    };

    const result = await sendBackchargeViaEmail(
      email,
      supplierName || '',
      recipientName || '',
      [attachment],
      equipment
    );

    sendSuccess(res, { success: true, data: result });
  } catch (error) {
    logger.error('[Backcharge] sendBackchargeViaEmail:', error);
    sendError(res, { success: false, message: error.message });
  }
};

/**
 * PUT /update-supplier-email/:supplierCode
 * Updates the saved email for all records sharing the same supplier code.
 */
const updateSupplierEmail = async (req, res) => {
  try {
    const { supplierCode } = req.params;
    const { email } = req.body;

    if (!email || !email.includes('@')) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'Valid email required' });
    }

    const result = await backchargeService.saveSupplierEmail(
      supplierCode,
      email
    );

    sendSuccess(res, {
      success: true,
      message: `Email updated for all records with supplier code ${supplierCode}`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    logger.error('[Backcharge] updateSupplierEmail:', error);
    sendError(res, { success: false, message: error.message });
  }
};

/**
 * PUT /update-backcharge/:id
 * Updates a backcharge report by ID.
 */
const updateBackcharge = async (req, res) => {
  try {
    const report = await backchargeService.updateBackcharge(
      req.params.id,
      req.body
    );

    if (!report) {
      return res
        .status(HTTP.NOT_FOUND)
        .json({ success: false, message: 'Backcharge report not found' });
    }

    sendSuccess(res, {
      success: true,
      message: 'Backcharge report updated successfully',
      data: report,
    });
  } catch (error) {
    logger.error('[Backcharge] updateBackcharge:', error);
    sendError(res, {
      success: false,
      message: 'Error updating backcharge report',
      error: error.message,
    });
  }
};

/**
 * DELETE /delete-backcharge/:id
 * Deletes a backcharge report by ID.
 */
const deleteBackcharge = async (req, res) => {
  try {
    const report = await backchargeService.deleteBackcharge(req.params.id);

    if (!report) {
      return res
        .status(HTTP.NOT_FOUND)
        .json({ success: false, message: 'Backcharge report not found' });
    }

    sendSuccess(res, {
      success: true,
      message: 'Backcharge report deleted successfully',
    });
  } catch (error) {
    logger.error('[Backcharge] deleteBackcharge:', error);
    sendError(res, {
      success: false,
      message: 'Error deleting backcharge report',
      error: error.message,
    });
  }
};

/**
 * GET /check-latest-backcharge-ref
 * Returns the latest backcharge reference number.
 */
const getLatestBackchargeRef = async (req, res) => {
  try {
    const latestNumber = await backchargeService.getLatestBackchargeRef();

    sendSuccess(res, {
      success: true,
      message: 'Latest backcharge reference retrieved successfully',
      data: { latestNumber },
    });
  } catch (error) {
    logger.error('[Backcharge] getLatestBackchargeRef:', error);
    sendError(res, {
      success: false,
      message: 'Error retrieving latest backcharge reference',
      error: error.message,
    });
  }
};

/**
 * GET /equipment/search
 * Searches equipment by plate number (min 2 characters).
 */
const searchEquipmentByPlate = async (req, res) => {
  try {
    const { plateNo } = req.query;

    if (!plateNo || plateNo.length < 2) {
      return sendError(res, {
        success: false,
        message: 'Plate number must be at least 2 characters',
      });
    }

    const equipment = await backchargeService.searchEquipmentByPlate(plateNo);

    sendSuccess(res, {
      success: true,
      message: 'Equipment search completed',
      data: equipment,
    });
  } catch (error) {
    logger.error('[Backcharge] searchEquipmentByPlate:', error);
    sendError(res, {
      success: false,
      message: 'Error searching equipment',
      error: error.message,
    });
  }
};

/**
 * GET /suppliers/search
 * Searches suppliers by name (min 2 characters).
 */
const searchSuppliers = async (req, res) => {
  try {
    const { name } = req.query;

    if (!name || name.length < 2) {
      return sendError(res, {
        success: false,
        message: 'Supplier name must be at least 2 characters',
      });
    }

    const suppliers = await backchargeService.searchSuppliers(name);

    sendSuccess(res, {
      success: true,
      message: 'Supplier search completed',
      data: suppliers,
    });
  } catch (error) {
    logger.error('[Backcharge] searchSuppliers:', error);
    sendError(res, {
      success: false,
      message: 'Error searching suppliers',
      error: error.message,
    });
  }
};

/**
 * GET /sites/search
 * Searches sites by location (min 2 characters).
 */
const searchSites = async (req, res) => {
  try {
    const { location } = req.query;

    if (!location || location.length < 2) {
      return sendError(res, {
        success: false,
        message: 'Site location must be at least 2 characters',
      });
    }

    const sites = await backchargeService.searchSites(location);

    res
      .status(HTTP.OK)
      .json({ success: true, message: 'Site search completed', data: sites });
  } catch (error) {
    logger.error('[Backcharge] searchSites:', error);
    sendError(res, {
      success: false,
      message: 'Error searching sites',
      error: error.message,
    });
  }
};

/**
 * POST /sign/:refNo
 * Identifies the signer by uniqueCode server-side and records the signature.
 * Supports override flag for out-of-order signing.
 * No role is trusted from the client.
 */
const signBackcharge = async (req, res) => {
  try {
    const { refNo } = req.params;
    const {
      uniqueCode,
      signedDate,
      signedFrom,
      override = false,
      signedIP,
      signedDevice,
      signedLocation,
    } = req.body;

    if (!uniqueCode) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'uniqueCode is required' });
    }

    if (!signedDate || !signedFrom) {
      return sendError(res, {
        success: false,
        message: 'signedDate and signedFrom are required',
      });
    }

    const result = await backchargeService.signBackcharge(refNo, {
      uniqueCode,
      signedDate,
      signedFrom,
      override,
      signedIP,
      signedDevice,
      signedLocation,
    });

    // Out-of-order detected — frontend will show override prompt
    if (result.requireOverride) {
      return sendError(res, {
        success: false,
        requireOverride: true,
        unsignedAbove: result.unsignedAbove,
        message: result.message,
      });
    }

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Backcharge] signBackcharge:', error);
    sendError(res, {
      success: false,
      message: error.message || 'Failed to sign backcharge',
    });
  }
};

/**
 * GET /pending-signatures
 * Returns all backcharge documents awaiting signature from the calling user.
 * uniqueCode is passed as a query param (resolved server-side — no role trusted from client).
 */
const getPendingSignatures = async (req, res) => {
  try {
    const { uniqueCode } = req.body;

    if (!uniqueCode) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'uniqueCode is required' });
    }

    const pending = await backchargeService.getPendingSignatures(uniqueCode);

    sendSuccess(res, {
      success: true,
      message: 'Pending signatures retrieved successfully',
      data: pending,
      count: pending.length,
    });
  } catch (error) {
    logger.error('[Backcharge] getPendingSignatures:', error);
    sendError(res, { success: false, message: error.message });
  }
};

/**
 * POST /signed-by-user
 * Returns all backcharge documents the calling user has already signed.
 * uniqueCode is resolved server-side — no role trusted from client.
 */
const getSignedByUser = async (req, res) => {
  try {
    const { uniqueCode } = req.body;

    if (!uniqueCode) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'uniqueCode is required' });
    }

    const signed = await backchargeService.getSignedByUser(uniqueCode);

    sendSuccess(res, {
      success: true,
      message: 'Signed documents retrieved successfully',
      data: signed,
      count: signed.length,
    });
  } catch (error) {
    logger.error('[Backcharge] getSignedByUser:', error);
    sendError(res, { success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  getAllBackchargeReports,
  getBackchargeById,
  getBackchargeByReportNo,
  getBackchargeByRefNo,
  addBackcharge,
  sendBackchargeToEmail,
  updateSupplierEmail,
  updateBackcharge,
  deleteBackcharge,
  getLatestBackchargeRef,
  searchEquipmentByPlate,
  searchSuppliers,
  searchSites,
  signBackcharge,
  getPendingSignatures,
  getSignedByUser,
};
