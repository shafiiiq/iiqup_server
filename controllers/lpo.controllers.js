// controllers/lpo.controller.js
const lpoService          = require('../services/lpo.service');
const { putObject }       = require('../aws/s3.aws');
const { sendLPOViaEmail } = require('../gmail/lpo.gmail');

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
// LPO CRUD Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /lpo
 * Creates a new LPO record.
 */
const addLPO = async (req, res) => {
  try {
    const lpoData = req.body;

    if (!lpoData.lpoRef || !lpoData.date || !lpoData.equipments || !lpoData.quoteNo) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: lpoRef, date, equipments, quoteNo',
      });
    }

    if (!lpoData.company?.vendor || !lpoData.company?.attention || !lpoData.company?.designation) {
      return res.status(400).json({
        success: false,
        message: 'Missing required company fields: vendor, attention, designation',
      });
    }

    if (!lpoData.items || !Array.isArray(lpoData.items) || lpoData.items.length === 0) {
      return res.status(400).json({ success: false, message: 'items array is required and cannot be empty' });
    }

    if (!lpoData.lpoCounter) {
      lpoData.lpoCounter = await lpoService.getNextLPOCounter();
    }

    if (lpoData.paymentTerms && Array.isArray(lpoData.paymentTerms)) {
      const filteredTerms         = lpoData.paymentTerms.filter(term => term.trim() !== '');
      lpoData.termsAndConditions  = ['Terms & Conditions', ...filteredTerms];
    } else {
      lpoData.termsAndConditions = DEFAULT_TERMS;
    }

    if (!lpoData.signatures) lpoData.signatures = DEFAULT_SIGNATURES;

    lpoData.isAmendmented = false;
    lpoData.amendments    = [];

    const lpo = await lpoService.createLPO(lpoData);

    res.status(201).json({
      success: true,
      message: 'LPO created successfully',
      data:    lpo,
    });
  } catch (error) {
    console.error('[LPO] addLPO:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /lpo
 * Returns all LPO records.
 */
const getAllLPOs = async (req, res) => {
  try {
    const lpos = await lpoService.getAllLPOs();

    res.status(200).json({
      success: true,
      message: 'LPOs retrieved successfully',
      data:    lpos,
      count:   lpos.length,
    });
  } catch (error) {
    console.error('[LPO] getAllLPOs:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /lpo/ref/*
 * Returns a single LPO by reference number.
 */
const getLPOByRef = async (req, res) => {
  try {
    const refNo = req.params[0];

    if (!refNo) {
      return res.status(400).json({ success: false, message: 'Reference number is required' });
    }

    const lpo = await lpoService.getLPOByRef(refNo);

    res.status(200).json({
      success: true,
      message: 'LPO retrieved successfully',
      data:    lpo,
    });
  } catch (error) {
    console.error('[LPO] getLPOByRef:', error);
    const status = error.message === 'LPO not found' ? 404 : 500;
    res.status(status).json({ success: false, message: error.message });
  }
};

/**
 * POST /lpo/pending-signatures
 * Returns all LPOs awaiting signature from the calling user.
 * Role is resolved server-side from uniqueCode — nothing trusted from client.
 */
const getPendingSignatures = async (req, res) => {
  try {
    const { uniqueCode } = req.body;

    if (!uniqueCode) {
      return res.status(400).json({ success: false, message: 'uniqueCode is required' });
    }

    const pending = await lpoService.getPendingSignatures(uniqueCode);      

    res.status(200).json({
      success: true,
      message: 'Pending LPO signatures retrieved successfully',
      data:    pending,
      count:   pending.length,
    });
  } catch (error) {
    console.error('[LPO] getPendingSignatures:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /lpo/signed-by-user
 * Returns all LPOs already signed by the calling user.
 * Role resolved server-side from uniqueCode.
 */
const getSignedByUser = async (req, res) => {
  try {
    const { uniqueCode } = req.body;

    if (!uniqueCode) {
      return res.status(400).json({ success: false, message: 'uniqueCode is required' });
    }

    const signed = await lpoService.getSignedByUser(uniqueCode);

    res.status(200).json({
      success: true,
      message: 'Signed LPOs retrieved successfully',
      data:    signed,
      count:   signed.length,
    });
  } catch (error) {
    console.error('[LPO] getSignedByUser:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /lpo/latest
 * Returns the most recently created LPO.
 */
const getLatestLPO = async (req, res) => {
  try {
    const latestLPO = await lpoService.getLatestLPO();

    res.status(200).json({
      success: true,
      message: 'Latest LPO retrieved successfully',
      data:    latestLPO || null,
    });
  } catch (error) {
    console.error('[LPO] getLatestLPO:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /lpo/latest-ref
 * Returns the reference number of the most recently created LPO.
 */
const getLatestLPORef = async (req, res) => {
  try {
    const latestRef = await lpoService.getLatestLPORef();

    res.status(200).json({
      success: true,
      message: 'Latest LPO reference retrieved successfully',
      data:    { latestRef: latestRef || 'No LPO found' },
    });
  } catch (error) {
    console.error('[LPO] getLatestLPORef:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /lpo/:refNo
 * Updates or amends an LPO by reference number.
 */
const updateLPO = async (req, res) => {
  try {
    const { refNo }    = req.params;
    const updateData   = req.body;

    if (!refNo) {
      return res.status(400).json({ success: false, message: 'Reference number is required' });
    }

    const decodedRefNo = decodeURIComponent(refNo);
    const lpo          = await lpoService.updateLPO(decodedRefNo, updateData);

    res.status(200).json({
      success: true,
      message: updateData.isAmendmented ? 'LPO amended successfully' : 'LPO updated successfully',
      data:    lpo,
    });
  } catch (error) {
    console.error('[LPO] updateLPO:', error);
    const status = error.message === 'LPO not found' ? 404 : 500;
    res.status(status).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /lpo/:refNo
 * Deletes an LPO by reference number.
 */
const deleteLPO = async (req, res) => {
  try {
    const { refNo } = req.params;

    if (!refNo) {
      return res.status(400).json({ success: false, message: 'Reference number is required' });
    }

    const lpo = await lpoService.deleteLPO(refNo);

    res.status(200).json({
      success: true,
      message: 'LPO deleted successfully',
      data:    lpo,
    });
  } catch (error) {
    console.error('[LPO] deleteLPO:', error);
    const status = error.message === 'LPO not found' ? 404 : 500;
    res.status(status).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Query Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /lpo/company-details
 * Returns all unique company/vendor details referenced in LPOs.
 */
const getCompanyDetails = async (req, res) => {
  try {
    const companyDetails = await lpoService.getAllCompanyDetails();

    res.status(200).json({
      success: true,
      message: 'Company details retrieved successfully',
      data:    companyDetails,
      count:   companyDetails.length,
    });
  } catch (error) {
    console.error('[LPO] getCompanyDetails:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /lpo/date-range
 * Returns LPOs within a given date range.
 */
const getLPOsByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'startDate and endDate are required' });
    }

    const lpos = await lpoService.getLPOsByDateRange(startDate, endDate);

    res.status(200).json({
      success: true,
      message: 'LPOs retrieved successfully',
      data:    lpos,
      count:   lpos.length,
    });
  } catch (error) {
    console.error('[LPO] getLPOsByDateRange:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /lpo/company/:vendorName
 * Returns all LPOs for a specific vendor.
 */
const getLPOsByCompany = async (req, res) => {
  try {
    const { vendorName } = req.params;

    if (!vendorName) {
      return res.status(400).json({ success: false, message: 'Vendor name is required' });
    }

    const lpos = await lpoService.getLPOsByCompany(vendorName);

    res.status(200).json({
      success: true,
      message: 'LPOs retrieved successfully',
      data:    lpos,
      count:   lpos.length,
    });
  } catch (error) {
    console.error('[LPO] getLPOsByCompany:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /lpo/reg/:regNo
 * Returns all LPOs associated with an equipment registration number.
 */
const getLposByRegNo = async (req, res) => {
  try {
    const { regNo } = req.params;

    if (!regNo) {
      return res.status(400).json({ success: false, message: 'Registration number is required' });
    }

    const lpos = await lpoService.getLposByRegNo(regNo);

    res.status(200).json({
      success: true,
      message: `LPOs for registration number ${regNo} retrieved successfully`,
      data:    lpos,
    });
  } catch (error) {
    console.error('[LPO] getLposByRegNo:', error);
    res.status(500).json({ success: false, message: 'Error retrieving LPOs by registration number', error: error.message });
  }
};

/**
 * GET /lpo/stock
 * Returns all LPOs flagged for stock.
 */
const getLposForStock = async (req, res) => {
  try {
    const lpos = await lpoService.getLposForStock();

    res.status(200).json({
      success: true,
      message: 'Stock LPOs retrieved successfully',
      data:    lpos,
    });
  } catch (error) {
    console.error('[LPO] getLposForStock:', error);
    res.status(500).json({ success: false, message: 'Error retrieving stock LPOs', error: error.message });
  }
};

/**
 * GET /lpo/all-equipments
 * Returns all LPOs linked to equipment records.
 */
const getLposForAllEquipments = async (req, res) => {
  try {
    const lpos = await lpoService.getLposForAllEquipments();

    res.status(200).json({
      success: true,
      message: 'All equipment LPOs retrieved successfully',
      data:    lpos,
    });
  } catch (error) {
    console.error('[LPO] getLposForAllEquipments:', error);
    res.status(500).json({ success: false, message: 'Error retrieving all equipment LPOs', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Approval Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PUT /lpo/:lpoRef/upload
 * Generates a pre-signed S3 URL and records the LPO file (or amendment).
 */
const uploadLPO = async (req, res) => {
  try {
    const { uploadedBy, lpoRef, description, fileName, isAmendment } = req.body;

    if (!uploadedBy || !lpoRef) {
      return res.status(400).json({ success: false, message: 'uploadedBy and lpoRef are required' });
    }

    const amendmentSuffix = isAmendment ? '-amendment' : '';
    const finalFilename   = fileName || `lpo-${lpoRef}${amendmentSuffix}-${Date.now()}.pdf`;
    const s3Key           = `lpos/${lpoRef}/${finalFilename}`;
    const uploadUrl       = await putObject(finalFilename, s3Key, 'application/pdf');

    const lpoFileData = {
      fileName:     finalFilename,
      originalName: finalFilename,
      filePath:     s3Key,
      mimeType:     'application/pdf',
      uploadUrl,
      uploadDate:   new Date(),
    };

    const result = await lpoService.uploadLPO(lpoFileData, uploadedBy, lpoRef, description, isAmendment);

    res.status(200).json({
      success:   true,
      message:   `Pre-signed URL generated successfully${isAmendment ? ' (Amendment)' : ''}`,
      uploadUrl,
      data:      { lpo: result, uploadData: lpoFileData },
    });
  } catch (error) {
    console.error('[LPO] uploadLPO:', error);
    res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to upload LPO' });
  }
};

/**
 * PUT /lpo/:lpoRef/purchase-approval
 * Step 6 — PURCHASE_MANAGER approves the LPO.
 */
const purchaseApproval = async (req, res) => {
  try {
    const { lpoRef }     = req.params;
    const { approvedBy, comments, signed, approvedDate, approvedFrom } = req.body;

    if (!approvedBy) {
      return res.status(400).json({ success: false, message: 'approvedBy is required' });
    }

    if (signed && (!approvedDate || !approvedFrom)) {
      return res.status(400).json({ success: false, message: 'approvedDate and approvedFrom are required for signing' });
    }

    const result = await lpoService.purchaseApproval(lpoRef, buildApprovedCreds(req.body));

    res.status(200).json({
      success: true,
      message: 'Purchase approval recorded successfully',
      data:    result,
    });
  } catch (error) {
    console.error('[LPO] purchaseApproval:', error);
    res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to approve purchase' });
  }
};

/**
 * PUT /lpo/:lpoRef/manager-approval
 * Step 7a — Manager approves the LPO.
 */
const managerApproval = async (req, res) => {
  try {
    const { lpoRef }     = req.params;
    const { approvedBy, comments } = req.body;

    if (!approvedBy) {
      return res.status(400).json({ success: false, message: 'approvedBy is required' });
    }

    const result = await lpoService.managerApproval(lpoRef, approvedBy, comments, buildApprovedCreds(req.body));

    res.status(200).json({
      success: true,
      message: 'Manager approval recorded successfully',
      data:    result,
    });
  } catch (error) {
    console.error('[LPO] managerApproval:', error);
    res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to get manager approval' });
  }
};

/**
 * PUT /lpo/:lpoRef/ceo-approval
 * Step 7b — CEO gives final approval on the LPO.
 */
const ceoApproval = async (req, res) => {
  try {
    const { lpoRef }                  = req.params;
    const { approvedBy, comments, authUser } = req.body;

    if (!approvedBy) {
      return res.status(400).json({ success: false, message: 'approvedBy is required' });
    }

    const result = await lpoService.ceoApproval(lpoRef, approvedBy, comments, buildApprovedCreds(req.body), authUser);

    res.status(200).json({
      success: true,
      message: 'CEO approval recorded successfully',
      data:    result,
    });
  } catch (error) {
    console.error('[LPO] ceoApproval:', error);
    res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to get CEO approval' });
  }
};

/**
 * PUT /lpo/:lpoRef/accounts-approval
 * Records accounts department approval on the LPO.
 */
const accountsApproval = async (req, res) => {
  try {
    const { lpoRef }               = req.params;
    const { approvedBy, comments } = req.body;

    if (!approvedBy) {
      return res.status(400).json({ success: false, message: 'approvedBy is required' });
    }

    const result = await lpoService.accountsApproval(lpoRef, approvedBy, comments, buildApprovedCreds(req.body));

    res.status(200).json({
      success: true,
      message: 'Accounts approval recorded successfully',
      data:    result,
    });
  } catch (error) {
    console.error('[LPO] accountsApproval:', error);
    res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to record accounts approval' });
  }
};

/**
 * PUT /lpo/:lpoRef/mark-items-available
 * Step 8 — Marks LPO items as available/received.
 */
const markItemsAvailable = async (req, res) => {
  try {
    const { lpoRef }  = req.params;
    const { markedBy } = req.body;

    if (!markedBy) {
      return res.status(400).json({ success: false, message: 'markedBy is required' });
    }

    const result = await lpoService.markItemsAvailable(lpoRef, markedBy);

    res.status(200).json({
      success: true,
      message: 'Items marked as available successfully',
      data:    result,
    });
  } catch (error) {
    console.error('[LPO] markItemsAvailable:', error);
    res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to mark items as available' });
  }
};

/**
 * POST /lpo/:lpoRef/sign
 * Records a signature on the LPO identified by uniqueCode server-side.
 */
const signLPO = async (req, res) => { 
  try {
    const { lpoRef } = req.params;
    const {
      uniqueCode, signedDate, signedFrom,
      signedIP, signedDevice, signedLocation,
      override = false,        
    } = req.body;

    if (!uniqueCode || !signedDate || !signedFrom) {
      return res.status(400).json({ success: false, message: 'uniqueCode, signedDate, and signedFrom are required' });
    }

    const result = await lpoService.signLPO(lpoRef, {
      uniqueCode, signedDate, signedFrom,
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
    console.error('[LPO] signLPO:', error);
    res.status(error.status || 500).json({ success: false, message: error.message || 'Signing failed' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Email Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /lpo/send-via-email
 * Sends the LPO PDF to the vendor via email and optionally saves their email.
 */
const sendLpoViaEmail = async (req, res) => {
  try {
    const { emails: rawEmails, recipientName, vendorName, equipment, lpoRef } = req.body;
    const emails = typeof rawEmails === 'string' ? JSON.parse(rawEmails) : rawEmails;
    const pdfFile = req.files?.pdf?.[0];
    const extraFiles = req.files?.attachments || [];

    if (!emails?.length || !pdfFile) {
      return res.status(400).json({ success: false, message: 'At least one email and PDF are required' });
    }

    const cleanEquipment = equipment
      ? equipment.replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim()
      : '';

    if (lpoRef) {
      const doc = await lpoService.getLPOByRef(lpoRef);
      if (doc?.vendorCode) {
        await lpoService.saveVendorEmail(doc.vendorCode, emails);
      }
    }

    const attachmentsList = [
      {
        content: pdfFile.buffer,
        filename: pdfFile.originalname || 'lpo.pdf',
        mimeType: 'application/pdf',
      },
      ...extraFiles.map(f => ({
        content: f.buffer,
        filename: f.originalname || 'attachment',
        mimeType: f.mimetype || 'application/octet-stream',
      }))
    ];

    const result = await sendLPOViaEmail(emails, vendorName || '', recipientName || '', attachmentsList, cleanEquipment);

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('[LPO] sendLpoViaEmail:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /lpo/vendor-email/:vendorCode
 * Updates the saved email address for all LPOs sharing the same vendor code.
 */
const updateVendorEmail = async (req, res) => {
  try {
    const { vendorCode } = req.params;
    const { email }      = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, message: 'Valid email required' });
    }

    const result = await lpoService.saveVendorEmail(vendorCode, email);

    res.status(200).json({
      success:       true,
      message:       `Email updated for vendor code ${vendorCode}`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error('[LPO] updateVendorEmail:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // CRUD
  addLPO,
  getAllLPOs,
  getLPOByRef,
  getLatestLPO,
  getLatestLPORef,
  updateLPO,
  deleteLPO,
  // Queries
  getCompanyDetails,
  getLPOsByDateRange,
  getLPOsByCompany,
  getLposByRegNo,
  getLposForStock,
  getLposForAllEquipments,
  // Approvals
  uploadLPO, 
  purchaseApproval,
  managerApproval,
  ceoApproval,
  accountsApproval,
  markItemsAvailable,
  signLPO,
  getPendingSignatures,
  getSignedByUser,
  // Email
  sendLpoViaEmail,
  updateVendorEmail,
};