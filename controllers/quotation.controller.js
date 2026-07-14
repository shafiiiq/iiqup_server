// controllers/quotation.controller.js
const quotationService          = require('../services/quotation.service');
const { putObject }       = require('../aws/s3.aws');
const { sendQuotationViaEmail } = require('../gmail/quotation.gmail');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_SIGNATURES = {
  accountsDept:              'ROSHAN SHA',
  purchasingManager:         'ABDUL MALIK',
  operationsManager:         'SURESHKANTH',
  authorizedSignatory:       'AHAMMED KAMAL',
  authorizedSignatoryTitle:  'CEO',
};

const DEFAULT_TERMS = [
  'Terms & Conditions',
  'Payment will be made within 90 days from the day of submission of invoice',
];

const buildApprovedCreds = (body) => ({
  signed:          body.signed      || false,
  authorised:      body.authorised  || false,
  approvedDate:    body.approvedDate,
  approvedFrom:    body.approvedFrom,
  approvedIP:      body.approvedIP,
  approvedBDevice: body.approvedBDevice,
  approvedLocation: body.approvedLocation,
  approvedBy:      body.approvedBy,
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

    if (!quotationData.quotationRef || !quotationData.date || !quotationData.equipments || !quotationData.quoteNo) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: quotationRef, date, equipments, quoteNo',
      });
    }

    if (!quotationData.company?.vendor || !quotationData.company?.attention || !quotationData.company?.designation) {
      return res.status(400).json({
        success: false,
        message: 'Missing required company fields: vendor, attention, designation',
      });
    }

    if (!quotationData.items || !Array.isArray(quotationData.items) || quotationData.items.length === 0) {
      return res.status(400).json({ success: false, message: 'items array is required and cannot be empty' });
    }

    if (!quotationData.quotationCounter) {
      quotationData.quotationCounter = await quotationService.getNextQuotationCounter();
    }

    if (quotationData.paymentTerms && Array.isArray(quotationData.paymentTerms)) {
      const filteredTerms         = quotationData.paymentTerms.filter(term => term.trim() !== '');
      quotationData.termsAndConditions  = ['Terms & Conditions', ...filteredTerms];
    } else {
      quotationData.termsAndConditions = DEFAULT_TERMS;
    }

    if (!quotationData.signatures) quotationData.signatures = DEFAULT_SIGNATURES;

    quotationData.isAmendmented = false;
    quotationData.amendments    = [];

    const quotation = await quotationService.createQuotation(quotationData);

    res.status(201).json({
      success: true,
      message: 'Quotation created successfully',
      data:    quotation,
    });
  } catch (error) {
    console.error('[Quotation] addQuotation:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /quotation
 * Returns all Quotation records.
 */
const getAllQuotations = async (req, res) => {
  try {
    const quotations = await quotationService.getAllQuotations();

    res.status(200).json({
      success: true,
      message: 'Quotations retrieved successfully',
      data:    quotations,
      count:   quotations.length,
    });
  } catch (error) {
    console.error('[Quotation] getAllQuotations:', error);
    res.status(500).json({ success: false, message: error.message });
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
      return res.status(400).json({ success: false, message: 'Reference number is required' });
    }

    const quotation = await quotationService.getQuotationByRef(refNo);

    res.status(200).json({
      success: true,
      message: 'Quotation retrieved successfully',
      data:    quotation,
    });
  } catch (error) {
    console.error('[Quotation] getQuotationByRef:', error);
    const status = error.message === 'Quotation not found' ? 404 : 500;
    res.status(status).json({ success: false, message: error.message });
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

    console.log("uniqueCode", uniqueCode)

    if (!uniqueCode) {
      return res.status(400).json({ success: false, message: 'uniqueCode is required' });
    }

    const pending = await quotationService.getPendingSignatures(uniqueCode);      

    res.status(200).json({
      success: true,
      message: 'Pending Quotation signatures retrieved successfully',
      data:    pending,
      count:   pending.length,
    });
  } catch (error) {
    console.error('[Quotation] getPendingSignatures:', error);
    res.status(500).json({ success: false, message: error.message });
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
      return res.status(400).json({ success: false, message: 'uniqueCode is required' });
    }

    const signed = await quotationService.getSignedByUser(uniqueCode);

    res.status(200).json({
      success: true,
      message: 'Signed Quotations retrieved successfully',
      data:    signed,
      count:   signed.length,
    });
  } catch (error) {
    console.error('[Quotation] getSignedByUser:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /quotation/latest
 * Returns the most recently created Quotation.
 */
const getLatestQuotation = async (req, res) => {
  try {
    const latestQuotation = await quotationService.getLatestQuotation();

    res.status(200).json({
      success: true,
      message: 'Latest Quotation retrieved successfully',
      data:    latestQuotation || null,
    });
  } catch (error) {
    console.error('[Quotation] getLatestQuotation:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /quotation/latest-ref
 * Returns the reference number of the most recently created Quotation.
 */
const getLatestQuotationRef = async (req, res) => {
  try {
    const latestRef = await quotationService.getLatestQuotationRef();

    res.status(200).json({
      success: true,
      message: 'Latest Quotation reference retrieved successfully',
      data:    { latestRef: latestRef || 'No Quotation found' },
    });
  } catch (error) {
    console.error('[Quotation] getLatestQuotationRef:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /quotation/:refNo
 * Updates or amends an Quotation by reference number.
 */
const updateQuotation = async (req, res) => {
  try {
    const { refNo }    = req.params;
    const updateData   = req.body;

    if (!refNo) {
      return res.status(400).json({ success: false, message: 'Reference number is required' });
    }

    const decodedRefNo = decodeURIComponent(refNo);
    const quotation          = await quotationService.updateQuotation(decodedRefNo, updateData);

    res.status(200).json({
      success: true,
      message: updateData.isAmendmented ? 'Quotation amended successfully' : 'Quotation updated successfully',
      data:    quotation,
    });
  } catch (error) {
    console.error('[Quotation] updateQuotation:', error);
    const status = error.message === 'Quotation not found' ? 404 : 500;
    res.status(status).json({ success: false, message: error.message });
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
      return res.status(400).json({ success: false, message: 'Reference number is required' });
    }

    const quotation = await quotationService.deleteQuotation(refNo);

    res.status(200).json({
      success: true,
      message: 'Quotation deleted successfully',
      data:    quotation,
    });
  } catch (error) {
    console.error('[Quotation] deleteQuotation:', error);
    const status = error.message === 'Quotation not found' ? 404 : 500;
    res.status(status).json({ success: false, message: error.message });
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

    res.status(200).json({
      success: true,
      message: 'Company details retrieved successfully',
      data:    companyDetails,
      count:   companyDetails.length,
    });
  } catch (error) {
    console.error('[Quotation] getCompanyDetails:', error);
    res.status(500).json({ success: false, message: error.message });
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
      return res.status(400).json({ success: false, message: 'startDate and endDate are required' });
    }

    const quotations = await quotationService.getQuotationsByDateRange(startDate, endDate);

    res.status(200).json({
      success: true,
      message: 'Quotations retrieved successfully',
      data:    quotations,
      count:   quotations.length,
    });
  } catch (error) {
    console.error('[Quotation] getQuotationsByDateRange:', error);
    res.status(500).json({ success: false, message: error.message });
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
      return res.status(400).json({ success: false, message: 'Vendor name is required' });
    }

    const quotations = await quotationService.getQuotationsByCompany(vendorName);

    res.status(200).json({
      success: true,
      message: 'Quotations retrieved successfully',
      data:    quotations,
      count:   quotations.length,
    });
  } catch (error) {
    console.error('[Quotation] getQuotationsByCompany:', error);
    res.status(500).json({ success: false, message: error.message });
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
      return res.status(400).json({ success: false, message: 'Registration number is required' });
    }

    const quotations = await quotationService.getQuotationsByRegNo(regNo);

    res.status(200).json({
      success: true,
      message: `Quotations for registration number ${regNo} retrieved successfully`,
      data:    quotations,
    });
  } catch (error) {
    console.error('[Quotation] getQuotationsByRegNo:', error);
    res.status(500).json({ success: false, message: 'Error retrieving Quotations by registration number', error: error.message });
  }
};

/**
 * GET /quotation/stock
 * Returns all Quotations flagged for stock.
 */
const getQuotationsForStock = async (req, res) => {
  try {
    const quotations = await quotationService.getQuotationsForStock();

    res.status(200).json({
      success: true,
      message: 'Stock Quotations retrieved successfully',
      data:    quotations,
    });
  } catch (error) {
    console.error('[Quotation] getQuotationsForStock:', error);
    res.status(500).json({ success: false, message: 'Error retrieving stock Quotations', error: error.message });
  }
};

/**
 * GET /quotation/all-equipments
 * Returns all Quotations linked to equipment records.
 */
const getQuotationsForAllEquipments = async (req, res) => {
  try {
    const quotations = await quotationService.getQuotationsForAllEquipments();

    res.status(200).json({
      success: true,
      message: 'All equipment Quotations retrieved successfully',
      data:    quotations,
    });
  } catch (error) {
    console.error('[Quotation] getQuotationsForAllEquipments:', error);
    res.status(500).json({ success: false, message: 'Error retrieving all equipment Quotations', error: error.message });
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
    const { uploadedBy, quotationRef, description, fileName, isAmendment } = req.body;

    if (!uploadedBy || !quotationRef) {
      return res.status(400).json({ success: false, message: 'uploadedBy and quotationRef are required' });
    }

    const amendmentSuffix = isAmendment ? '-amendment' : '';
    const finalFilename   = fileName || `quotation-${quotationRef}${amendmentSuffix}-${Date.now()}.pdf`;  
    const s3Key           = `quotations/${quotationRef}/${finalFilename}`;
    const uploadUrl       = await putObject(finalFilename, s3Key, 'application/pdf');

    const quotationFileData = {
      fileName:     finalFilename,
      originalName: finalFilename,
      filePath:     s3Key,
      mimeType:     'application/pdf',
      uploadUrl,
      uploadDate:   new Date(),
    };

    const result = await quotationService.uploadQuotation(quotationFileData, uploadedBy, quotationRef, description, isAmendment);

    res.status(200).json({
      success:   true,
      message:   `Pre-signed URL generated successfully${isAmendment ? ' (Amendment)' : ''}`,
      uploadUrl,
      data:      { quotation: result, uploadData: quotationFileData },
    });
  } catch (error) {
    console.error('[Quotation] uploadQuotation:', error);
    res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to upload Quotation' });
  }
};

/**
 * PUT /quotation/:quotationRef/purchase-approval
 * Step 6 — PURCHASE_MANAGER approves the Quotation.
 */
const purchaseApproval = async (req, res) => {
  try {
    const { quotationRef }     = req.params;
    const { approvedBy, comments, signed, approvedDate, approvedFrom } = req.body;

    if (!approvedBy) {
      return res.status(400).json({ success: false, message: 'approvedBy is required' });
    }

    if (signed && (!approvedDate || !approvedFrom)) {
      return res.status(400).json({ success: false, message: 'approvedDate and approvedFrom are required for signing' });
    }

    const result = await quotationService.purchaseApproval(quotationRef, buildApprovedCreds(req.body));

    res.status(200).json({
      success: true,
      message: 'Purchase approval recorded successfully',
      data:    result,
    });
  } catch (error) {
    console.error('[Quotation] purchaseApproval:', error);
    res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to approve purchase' });
  }
};

/**
 * PUT /quotation/:quotationRef/manager-approval
 * Step 7a — Manager approves the Quotation.
 */
const managerApproval = async (req, res) => {
  try {
    const { quotationRef }     = req.params;
    const { approvedBy, comments } = req.body;

    if (!approvedBy) {
      return res.status(400).json({ success: false, message: 'approvedBy is required' });
    }

    const result = await quotationService.managerApproval(quotationRef, approvedBy, comments, buildApprovedCreds(req.body));

    res.status(200).json({
      success: true,
      message: 'Manager approval recorded successfully',
      data:    result,
    });
  } catch (error) {
    console.error('[Quotation] managerApproval:', error);
    res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to get manager approval' });
  }
};

/**
 * PUT /quotation/:quotationRef/ceo-approval
 * Step 7b — CEO gives final approval on the Quotation.
 */
const ceoApproval = async (req, res) => {
  try {
    const { quotationRef }                  = req.params;
    const { approvedBy, comments, authUser } = req.body;

    if (!approvedBy) {
      return res.status(400).json({ success: false, message: 'approvedBy is required' });
    }

    const result = await quotationService.ceoApproval(quotationRef, approvedBy, comments, buildApprovedCreds(req.body), authUser);

    res.status(200).json({
      success: true,
      message: 'CEO approval recorded successfully',
      data:    result,
    });
  } catch (error) {
    console.error('[Quotation] ceoApproval:', error);
    res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to get CEO approval' });
  }
};

/**
 * PUT /quotation/:quotationRef/accounts-approval
 * Records accounts department approval on the Quotation.
 */
const accountsApproval = async (req, res) => {
  try {
    const { quotationRef }               = req.params;
    const { approvedBy, comments } = req.body;

    if (!approvedBy) {
      return res.status(400).json({ success: false, message: 'approvedBy is required' });
    }

    const result = await quotationService.accountsApproval(quotationRef, approvedBy, comments, buildApprovedCreds(req.body));

    res.status(200).json({
      success: true,
      message: 'Accounts approval recorded successfully',
      data:    result,
    });
  } catch (error) {
    console.error('[Quotation] accountsApproval:', error);
    res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to record accounts approval' });
  }
};

/**
 * PUT /quotation/:quotationRef/mark-items-available
 * Step 8 — Marks Quotation items as available/received.
 */
const markItemsAvailable = async (req, res) => {
  try {
    const { quotationRef }  = req.params;
    const { markedBy } = req.body;

    if (!markedBy) {
      return res.status(400).json({ success: false, message: 'markedBy is required' });
    }

    const result = await quotationService.markItemsAvailable(quotationRef, markedBy);

    res.status(200).json({
      success: true,
      message: 'Items marked as available successfully',
      data:    result,
    });
  } catch (error) {
    console.error('[Quotation] markItemsAvailable:', error);
    res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to mark items as available' });
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
      uniqueCode, signedDate, signedFrom, role,
      signedIP, signedDevice, signedLocation,
      override = false,        
    } = req.body;

    if (!uniqueCode || !signedDate || !signedFrom) {
      return res.status(400).json({ success: false, message: 'uniqueCode, signedDate, and signedFrom are required' });
    }

    const result = await quotationService.signQuotation(quotationRef, {
      uniqueCode, signedDate, signedFrom, role,
      signedIP, signedDevice, signedLocation,
      override,                
    });

    // Out-of-order prompt — return 202 so frontend can ask user
    if (result.requireOverride) {
      return res.status(202).json({
        success:         false,
        requireOverride: true,
        message:         result.message,
        unsignedAbove:   result.unsignedAbove,
      });
    }

    res.status(200).json({
      success: true,
      message: result.message,
      data:    result.data,
    });
  } catch (error) {
    console.error('[Quotation] signQuotation:', error);
    res.status(error.status || 500).json({ success: false, message: error.message || 'Signing failed' });
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
    const { emails: rawEmails, recipientName, vendorName, equipment, quotationRef } = req.body;
    const emails = typeof rawEmails === 'string' ? JSON.parse(rawEmails) : rawEmails;
    const pdfFile = req.files?.pdf?.[0];
    const extraFiles = req.files?.attachments || [];

    if (!emails?.length || !pdfFile) {
      return res.status(400).json({ success: false, message: 'At least one email and PDF are required' });
    }

    const cleanEquipment = equipment
      ? equipment.replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim()
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
      ...extraFiles.map(f => ({
        content: f.buffer,
        filename: f.originalname || 'attachment',
        mimeType: f.mimetype || 'application/octet-stream',
      }))
    ];

    const result = await sendQuotationViaEmail(emails, vendorName || '', recipientName || '', attachmentsList, cleanEquipment);

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('[Quotation] sendQuotationViaEmail:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /quotation/vendor-email/:vendorCode
 * Updates the saved email address for all Quotations sharing the same vendor code.
 */
const updateVendorEmail = async (req, res) => {
  try {
    const { vendorCode } = req.params;
    const { email }      = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, message: 'Valid email required' });
    }

    const result = await quotationService.saveVendorEmail(vendorCode, email);

    res.status(200).json({
      success:       true,
      message:       `Email updated for vendor code ${vendorCode}`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error('[Quotation] updateVendorEmail:', error);
    res.status(500).json({ success: false, message: error.message });
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