const logger = require('../../shared/logger/logger');

const HTTP = require('../../shared/constants/httpStatus.constant.js');
const { sendSuccess, sendError } = require('../../shared/response/response.util');
// controllers/quotation.controller.js
const quotationService = require('./quotation.service');
const { putObject } = require('../../config/aws/s3.aws');
const {
  sendQuotationViaEmail: sendQuotationEmail,
} = require('../gmail/quotation.gmail');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_SIGNATURES = {
  accountsDept: 'ROSHAN SHA',
  purchasingManager: 'ABDUL MALIK',
  operationsManager: 'SURESHKANTH',
  authorizedSignatory: 'AHAMMED KAMAL',
  authorizedSignatoryTitle: 'CEO',
};

const DEFAULT_TERMS = [
  'Terms & Conditions',
  'Payment will be made within 90 days from the day of submission of invoice',
];

const buildApprovedCreds = (body) => ({
  signed: body.signed || false,
  authorised: body.authorised || false,
  approvedDate: body.approvedDate,
  approvedFrom: body.approvedFrom,
  approvedIP: body.approvedIP,
  approvedBDevice: body.approvedBDevice,
  approvedLocation: body.approvedLocation,
  approvedBy: body.approvedBy,
});

// ─────────────────────────────────────────────────────────────────────────────
// Quotation CRUD Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /quotation
 * Creates a new Quotation record.
 */
const addQuotation = async (req, res) => {
  try {
    const quotationData = req.body;

    if (
      !quotationData.quotationRef ||
      !quotationData.date ||
      !quotationData.equipments ||
      !quotationData.quoteNo
    ) {
      return sendError(res, {
        success: false,
        message:
          'Missing required fields: quotationRef, date, equipments, quoteNo',
      });
    }

    if (
      !quotationData.company?.vendor ||
      !quotationData.company?.attention ||
      !quotationData.company?.designation
    ) {
      return sendError(res, {
        success: false,
        message:
          'Missing required company fields: vendor, attention, designation',
      });
    }

    if (
      !quotationData.items ||
      !Array.isArray(quotationData.items) ||
      quotationData.items.length === 0
    ) {
      return sendError(res, {
        success: false,
        message: 'items array is required and cannot be empty',
      });
    }

    if (!quotationData.quotationCounter) {
      quotationData.quotationCounter =
        await quotationService.getNextQuotationCounter();
    }

    if (
      quotationData.paymentTerms &&
      Array.isArray(quotationData.paymentTerms)
    ) {
      const filteredTerms = quotationData.paymentTerms.filter(
        (term) => term.trim() !== ''
      );
      quotationData.termsAndConditions = [
        'Terms & Conditions',
        ...filteredTerms,
      ];
    } else {
      quotationData.termsAndConditions = DEFAULT_TERMS;
    }

    if (!quotationData.signatures)
      quotationData.signatures = DEFAULT_SIGNATURES;

    quotationData.isAmendmented = false;
    quotationData.amendments = [];

    const quotation = await quotationService.createQuotation(quotationData);

    sendSuccess(res, {
      success: true,
      message: 'Quotation created successfully',
      data: quotation,
    });
  } catch (error) {
    logger.error('[Quotation] addQuotation:', error);
    sendError(res, { success: false, message: error.message });
  }
};

/**
 * GET /quotation
 * Returns all Quotation records.
 */
const getAllQuotations = async (req, res) => {
  try {
    const result = await quotationService.getAllQuotations(req.pagination);

    sendSuccess(res, {
      success: true,
      message: 'Quotations retrieved successfully',
      data: result.data,
      pagination: result.pagination,
      count: result.data.length,
    });
  } catch (error) {
    logger.error('[Quotation] getAllQuotations:', error);
    sendError(res, { success: false, message: error.message });
  }
};

/**
 * GET /quotation/ref/*
 * Returns a single Quotation by reference number.
 */
const getQuotationByRef = async (req, res) => {
  try {
    const refNo = req.params[0];

    if (!refNo) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'Reference number is required' });
    }

    const quotation = await quotationService.getQuotationByRef(refNo);

    sendSuccess(res, {
      success: true,
      message: 'Quotation retrieved successfully',
      data: quotation,
    });
  } catch (error) {
    logger.error('[Quotation] getQuotationByRef:', error);
    const status = error.message === 'Quotation not found' ? HTTP.NOT_FOUND : HTTP.INTERNAL_SERVER_ERROR;
    sendError(res, { success: false, message: error.message });
  }
};

/**
 * POST /quotation/pending-signatures
 * Returns all Quotations awaiting signature from the calling user.
 * Role is resolved server-side from uniqueCode — nothing trusted from client.
 */
const getPendingSignatures = async (req, res) => {
  try {
    const { uniqueCode } = req.body;

    logger.info('uniqueCode', uniqueCode);

    if (!uniqueCode) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'uniqueCode is required' });
    }

    const pending = await quotationService.getPendingSignatures(uniqueCode);

    sendSuccess(res, {
      success: true,
      message: 'Pending Quotation signatures retrieved successfully',
      data: pending,
      count: pending.length,
    });
  } catch (error) {
    logger.error('[Quotation] getPendingSignatures:', error);
    sendError(res, { success: false, message: error.message });
  }
};

/**
 * POST /quotation/signed-by-user
 * Returns all Quotations already signed by the calling user.
 * Role resolved server-side from uniqueCode.
 */
const getSignedByUser = async (req, res) => {
  try {
    const { uniqueCode } = req.body;

    if (!uniqueCode) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'uniqueCode is required' });
    }

    const signed = await quotationService.getSignedByUser(uniqueCode);

    sendSuccess(res, {
      success: true,
      message: 'Signed Quotations retrieved successfully',
      data: signed,
      count: signed.length,
    });
  } catch (error) {
    logger.error('[Quotation] getSignedByUser:', error);
    sendError(res, { success: false, message: error.message });
  }
};

/**
 * GET /quotation/latest
 * Returns the most recently created Quotation.
 */
const getLatestQuotation = async (req, res) => {
  try {
    const latestQuotation = await quotationService.getLatestQuotation();

    sendSuccess(res, {
      success: true,
      message: 'Latest Quotation retrieved successfully',
      data: latestQuotation || null,
    });
  } catch (error) {
    logger.error('[Quotation] getLatestQuotation:', error);
    sendError(res, { success: false, message: error.message });
  }
};

/**
 * GET /quotation/latest-ref
 * Returns the reference number of the most recently created Quotation.
 */
const getLatestQuotationRef = async (req, res) => {
  try {
    const latestRef = await quotationService.getLatestQuotationRef();

    sendSuccess(res, {
      success: true,
      message: 'Latest Quotation reference retrieved successfully',
      data: { latestRef: latestRef || 'No Quotation found' },
    });
  } catch (error) {
    logger.error('[Quotation] getLatestQuotationRef:', error);
    sendError(res, { success: false, message: error.message });
  }
};

/**
 * PUT /quotation/:refNo
 * Updates or amends an Quotation by reference number.
 */
const updateQuotation = async (req, res) => {
  try {
    const { refNo } = req.params;
    const updateData = req.body;

    if (!refNo) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'Reference number is required' });
    }

    const decodedRefNo = decodeURIComponent(refNo);
    const quotation = await quotationService.updateQuotation(
      decodedRefNo,
      updateData
    );

    sendSuccess(res, {
      success: true,
      message: updateData.isAmendmented
        ? 'Quotation amended successfully'
        : 'Quotation updated successfully',
      data: quotation,
    });
  } catch (error) {
    logger.error('[Quotation] updateQuotation:', error);
    const status = error.message === 'Quotation not found' ? HTTP.NOT_FOUND : HTTP.INTERNAL_SERVER_ERROR;
    sendError(res, { success: false, message: error.message });
  }
};

/**
 * DELETE /quotation/:refNo
 * Deletes an Quotation by reference number.
 */
const deleteQuotation = async (req, res) => {
  try {
    const { refNo } = req.params;

    if (!refNo) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'Reference number is required' });
    }

    const quotation = await quotationService.deleteQuotation(refNo);

    sendSuccess(res, {
      success: true,
      message: 'Quotation deleted successfully',
      data: quotation,
    });
  } catch (error) {
    logger.error('[Quotation] deleteQuotation:', error);
    const status = error.message === 'Quotation not found' ? HTTP.NOT_FOUND : HTTP.INTERNAL_SERVER_ERROR;
    sendError(res, { success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Query Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /quotation/company-details
 * Returns all unique company/vendor details referenced in Quotations.
 */
const getCompanyDetails = async (req, res) => {
  try {
    const companyDetails = await quotationService.getAllCompanyDetails();

    sendSuccess(res, {
      success: true,
      message: 'Company details retrieved successfully',
      data: companyDetails,
      count: companyDetails.length,
    });
  } catch (error) {
    logger.error('[Quotation] getCompanyDetails:', error);
    sendError(res, { success: false, message: error.message });
  }
};

/**
 * GET /quotation/date-range
 * Returns Quotations within a given date range.
 */
const getQuotationsByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return sendError(res, {
        success: false,
        message: 'startDate and endDate are required',
      });
    }

    const quotations = await quotationService.getQuotationsByDateRange(
      startDate,
      endDate
    );

    sendSuccess(res, {
      success: true,
      message: 'Quotations retrieved successfully',
      data: quotations,
      count: quotations.length,
    });
  } catch (error) {
    logger.error('[Quotation] getQuotationsByDateRange:', error);
    sendError(res, { success: false, message: error.message });
  }
};

/**
 * GET /quotation/company/:vendorName
 * Returns all Quotations for a specific vendor.
 */
const getQuotationsByCompany = async (req, res) => {
  try {
    const { vendorName } = req.params;

    if (!vendorName) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'Vendor name is required' });
    }

    const quotations =
      await quotationService.getQuotationsByCompany(vendorName);

    sendSuccess(res, {
      success: true,
      message: 'Quotations retrieved successfully',
      data: quotations,
      count: quotations.length,
    });
  } catch (error) {
    logger.error('[Quotation] getQuotationsByCompany:', error);
    sendError(res, { success: false, message: error.message });
  }
};

/**
 * GET /quotation/reg/:regNo
 * Returns all Quotations associated with an equipment registration number.
 */
const getQuotationsByRegNo = async (req, res) => {
  try {
    const { regNo } = req.params;

    if (!regNo) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'Registration number is required' });
    }

    const quotations = await quotationService.getQuotationsByRegNo(regNo);

    sendSuccess(res, {
      success: true,
      message: `Quotations for registration number ${regNo} retrieved successfully`,
      data: quotations,
    });
  } catch (error) {
    logger.error('[Quotation] getQuotationsByRegNo:', error);
    sendError(res, {
      success: false,
      message: 'Error retrieving Quotations by registration number',
      error: error.message,
    });
  }
};

/**
 * GET /quotation/stock
 * Returns all Quotations flagged for stock.
 */
const getQuotationsForStock = async (req, res) => {
  try {
    const quotations = await quotationService.getQuotationsForStock();

    sendSuccess(res, {
      success: true,
      message: 'Stock Quotations retrieved successfully',
      data: quotations,
    });
  } catch (error) {
    logger.error('[Quotation] getQuotationsForStock:', error);
    sendError(res, {
      success: false,
      message: 'Error retrieving stock Quotations',
      error: error.message,
    });
  }
};

/**
 * GET /quotation/all-equipments
 * Returns all Quotations linked to equipment records.
 */
const getQuotationsForAllEquipments = async (req, res) => {
  try {
    const quotations = await quotationService.getQuotationsForAllEquipments();

    sendSuccess(res, {
      success: true,
      message: 'All equipment Quotations retrieved successfully',
      data: quotations,
    });
  } catch (error) {
    logger.error('[Quotation] getQuotationsForAllEquipments:', error);
    sendError(res, {
      success: false,
      message: 'Error retrieving all equipment Quotations',
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Approval Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PUT /quotation/:quotationRef/upload
 * Generates a pre-signed S3 URL and records the Quotation file (or amendment).
 */
const uploadQuotation = async (req, res) => {
  try {
    const { uploadedBy, quotationRef, description, fileName, isAmendment } =
      req.body;

    if (!uploadedBy || !quotationRef) {
      return sendError(res, {
        success: false,
        message: 'uploadedBy and quotationRef are required',
      });
    }

    const amendmentSuffix = isAmendment ? '-amendment' : '';
    const finalFilename =
      fileName ||
      `quotation-${quotationRef}${amendmentSuffix}-${Date.now()}.pdf`;
    const s3Key = `quotations/${quotationRef}/${finalFilename}`;
    const uploadUrl = await putObject(finalFilename, s3Key, 'application/pdf');

    const quotationFileData = {
      fileName: finalFilename,
      originalName: finalFilename,
      filePath: s3Key,
      mimeType: 'application/pdf',
      uploadUrl,
      uploadDate: new Date(),
    };

    const result = await quotationService.uploadQuotation(
      quotationFileData,
      uploadedBy,
      quotationRef,
      description,
      isAmendment
    );

    sendSuccess(res, {
      success: true,
      message: `Pre-signed URL generated successfully${isAmendment ? ' (Amendment)' : ''}`,
      uploadUrl,
      data: { quotation: result, uploadData: quotationFileData },
    });
  } catch (error) {
    logger.error('[Quotation] uploadQuotation:', error);
    sendError(res, {
      success: false,
      message: error.message || 'Failed to upload Quotation',
    });
  }
};

/**
 * PUT /quotation/:quotationRef/purchase-approval
 * Step 6 — PURCHASE_MANAGER approves the Quotation.
 */
const purchaseApproval = async (req, res) => {
  try {
    const { quotationRef } = req.params;
    const { approvedBy, comments, signed, approvedDate, approvedFrom } =
      req.body;

    if (!approvedBy) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'approvedBy is required' });
    }

    if (signed && (!approvedDate || !approvedFrom)) {
      return sendError(res, {
        success: false,
        message: 'approvedDate and approvedFrom are required for signing',
      });
    }

    const result = await quotationService.purchaseApproval(
      quotationRef,
      buildApprovedCreds(req.body)
    );

    sendSuccess(res, {
      success: true,
      message: 'Purchase approval recorded successfully',
      data: result,
    });
  } catch (error) {
    logger.error('[Quotation] purchaseApproval:', error);
    sendError(res, {
      success: false,
      message: error.message || 'Failed to approve purchase',
    });
  }
};

/**
 * PUT /quotation/:quotationRef/manager-approval
 * Step 7a — Manager approves the Quotation.
 */
const managerApproval = async (req, res) => {
  try {
    const { quotationRef } = req.params;
    const { approvedBy, comments } = req.body;

    if (!approvedBy) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'approvedBy is required' });
    }

    const result = await quotationService.managerApproval(
      quotationRef,
      approvedBy,
      comments,
      buildApprovedCreds(req.body)
    );

    sendSuccess(res, {
      success: true,
      message: 'Manager approval recorded successfully',
      data: result,
    });
  } catch (error) {
    logger.error('[Quotation] managerApproval:', error);
    sendError(res, {
      success: false,
      message: error.message || 'Failed to get manager approval',
    });
  }
};

/**
 * PUT /quotation/:quotationRef/ceo-approval
 * Step 7b — CEO gives final approval on the Quotation.
 */
const ceoApproval = async (req, res) => {
  try {
    const { quotationRef } = req.params;
    const { approvedBy, comments, authUser } = req.body;

    if (!approvedBy) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'approvedBy is required' });
    }

    const result = await quotationService.ceoApproval(
      quotationRef,
      approvedBy,
      comments,
      buildApprovedCreds(req.body),
      authUser
    );

    sendSuccess(res, {
      success: true,
      message: 'CEO approval recorded successfully',
      data: result,
    });
  } catch (error) {
    logger.error('[Quotation] ceoApproval:', error);
    sendError(res, {
      success: false,
      message: error.message || 'Failed to get CEO approval',
    });
  }
};

/**
 * PUT /quotation/:quotationRef/accounts-approval
 * Records accounts department approval on the Quotation.
 */
const accountsApproval = async (req, res) => {
  try {
    const { quotationRef } = req.params;
    const { approvedBy, comments } = req.body;

    if (!approvedBy) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'approvedBy is required' });
    }

    const result = await quotationService.accountsApproval(
      quotationRef,
      approvedBy,
      comments,
      buildApprovedCreds(req.body)
    );

    sendSuccess(res, {
      success: true,
      message: 'Accounts approval recorded successfully',
      data: result,
    });
  } catch (error) {
    logger.error('[Quotation] accountsApproval:', error);
    sendError(res, {
      success: false,
      message: error.message || 'Failed to record accounts approval',
    });
  }
};

/**
 * PUT /quotation/:quotationRef/mark-items-available
 * Step 8 — Marks Quotation items as available/received.
 */
const markItemsAvailable = async (req, res) => {
  try {
    const { quotationRef } = req.params;
    const { markedBy } = req.body;

    if (!markedBy) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'markedBy is required' });
    }

    const result = await quotationService.markItemsAvailable(
      quotationRef,
      markedBy
    );

    sendSuccess(res, {
      success: true,
      message: 'Items marked as available successfully',
      data: result,
    });
  } catch (error) {
    logger.error('[Quotation] markItemsAvailable:', error);
    sendError(res, {
      success: false,
      message: error.message || 'Failed to mark items as available',
    });
  }
};

/**
 * POST /quotation/:quotationRef/sign
 * Records a signature on the Quotation identified by uniqueCode server-side.
 */
const signQuotation = async (req, res) => {
  try {
    const { quotationRef } = req.params;
    const {
      uniqueCode,
      signedDate,
      signedFrom,
      role,
      signedIP,
      signedDevice,
      signedLocation,
      override = false,
    } = req.body;

    if (!uniqueCode || !signedDate || !signedFrom) {
      return sendError(res, {
        success: false,
        message: 'uniqueCode, signedDate, and signedFrom are required',
      });
    }

    const result = await quotationService.signQuotation(quotationRef, {
      uniqueCode,
      signedDate,
      signedFrom,
      role,
      signedIP,
      signedDevice,
      signedLocation,
      override,
    });

    // Out-of-order prompt — return 202 so frontend can ask user
    if (result.requireOverride) {
      return sendError(res, {
        success: false,
        requireOverride: true,
        message: result.message,
        unsignedAbove: result.unsignedAbove,
      });
    }

    sendSuccess(res, {
      success: true,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    logger.error('[Quotation] signQuotation:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message || 'Signing failed' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Email Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /quotation/send-via-email
 * Sends the Quotation PDF to the vendor via email and optionally saves their email.
 */
const sendQuotationViaEmail = async (req, res) => {
  try {
    const {
      emails: rawEmails,
      recipientName,
      vendorName,
      equipment,
      quotationRef,
    } = req.body;
    const emails =
      typeof rawEmails === 'string' ? JSON.parse(rawEmails) : rawEmails;
    const pdfFile = req.files?.pdf?.[0];
    const extraFiles = req.files?.attachments || [];

    if (!emails?.length || !pdfFile) {
      return sendError(res, {
        success: false,
        message: 'At least one email and PDF are required',
      });
    }

    const cleanEquipment = equipment
      ? equipment
          .replace(/[^\x20-\x7E]/g, '')
          .replace(/\s+/g, ' ')
          .trim()
      : '';

    if (quotationRef) {
      const doc = await quotationService.getQuotationByRef(quotationRef);
      if (doc?.vendorCode) {
        await quotationService.saveVendorEmail(doc.vendorCode, emails);
      }
    }

    const attachmentsList = [
      {
        content: pdfFile.buffer,
        filename: pdfFile.originalname || 'quotation.pdf',
        mimeType: 'application/pdf',
      },
      ...extraFiles.map((f) => ({
        content: f.buffer,
        filename: f.originalname || 'attachment',
        mimeType: f.mimetype || 'application/octet-stream',
      })),
    ];

    const result = await sendQuotationEmail(
      emails,
      vendorName || '',
      recipientName || '',
      attachmentsList,
      cleanEquipment
    );

    sendSuccess(res, { success: true, data: result });
  } catch (error) {
    logger.error('[Quotation] sendQuotationViaEmail:', error);
    sendError(res, { success: false, message: error.message });
  }
};

/**
 * PUT /quotation/vendor-email/:vendorCode
 * Updates the saved email address for all Quotations sharing the same vendor code.
 */
const updateVendorEmail = async (req, res) => {
  try {
    const { vendorCode } = req.params;
    const { email } = req.body;

    if (!email || !email.includes('@')) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'Valid email required' });
    }

    const result = await quotationService.saveVendorEmail(vendorCode, email);

    sendSuccess(res, {
      success: true,
      message: `Email updated for vendor code ${vendorCode}`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    logger.error('[Quotation] updateVendorEmail:', error);
    sendError(res, { success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // CRUD
  addQuotation,
  getAllQuotations,
  getQuotationByRef,
  getLatestQuotation,
  getLatestQuotationRef,
  updateQuotation,
  deleteQuotation,
  // Queries
  getCompanyDetails,
  getQuotationsByDateRange,
  getQuotationsByCompany,
  getQuotationsByRegNo,
  getQuotationsForStock,
  getQuotationsForAllEquipments,
  // Approvals
  uploadQuotation,
  purchaseApproval,
  managerApproval,
  ceoApproval,
  accountsApproval,
  markItemsAvailable,
  signQuotation,
  getPendingSignatures,
  getSignedByUser,
  // Email
  sendQuotationViaEmail,
  updateVendorEmail,
};
