// controllers/backcharge.controller.js
const backchargeService        = require('../services/backcharge.service');
const { sendBackchargeViaEmail } = require('../gmail/backcharge.gmail');

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

    res.status(200).json({
      success: true,
      message: 'Backcharge reports retrieved successfully',
      data:    reports,
    });
  } catch (error) {
    console.error('[Backcharge] getAllBackchargeReports:', error);
    res.status(500).json({ success: false, message: 'Error retrieving backcharge reports', error: error.message });
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
      return res.status(404).json({ success: false, message: 'Backcharge report not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Backcharge report retrieved successfully',
      data:    report,
    });
  } catch (error) {
    console.error('[Backcharge] getBackchargeById:', error);
    res.status(500).json({ success: false, message: 'Error retrieving backcharge report', error: error.message });
  }
};

/**
 * GET /get-backcharge-by-report/:reportNo
 * Returns a single backcharge report by report number.
 */
const getBackchargeByReportNo = async (req, res) => {
  try {
    const report = await backchargeService.getBackchargeByReportNo(req.params.reportNo);

    if (!report) {
      return res.status(404).json({ success: false, message: 'Backcharge report not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Backcharge report retrieved successfully',
      data:    report,
    });
  } catch (error) {
    console.error('[Backcharge] getBackchargeByReportNo:', error);
    res.status(500).json({ success: false, message: 'Error retrieving backcharge report', error: error.message });
  }
};

/**
 * GET /get-backcharge-by-ref/:refNo
 * Returns a single backcharge report by reference number.
 */
const getBackchargeByRefNo = async (req, res) => {
  try {
    const report = await backchargeService.getBackchargeByRefNo(req.params.refNo);

    if (!report) {
      return res.status(404).json({ success: false, message: 'Backcharge report not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Backcharge report retrieved successfully',
      data:    report,
    });
  } catch (error) {
    console.error('[Backcharge] getBackchargeByRefNo:', error);
    res.status(500).json({ success: false, message: 'Error retrieving backcharge report', error: error.message });
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
      return res.status(400).json({
        success: false,
        message: 'Report number, equipment type, and plate number are required',
      });
    }

    const existing = await backchargeService.getBackchargeByReportNo(reportNo);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Backcharge report with this report number already exists',
      });
    }

    const report = await backchargeService.addBackcharge(req.body);

    res.status(201).json({
      success: true,
      message: 'Backcharge report created successfully',
      data:    report,
    });
  } catch (error) {
    console.error('[Backcharge] addBackcharge:', error);
    res.status(500).json({ success: false, message: 'Error creating backcharge report', error: error.message });
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
      return res.status(400).json({ success: false, message: 'Email and PDF are required' });
    }

    if (refNo) {
      const doc = await backchargeService.getBackchargeByRefNo(refNo);
      if (doc?.supplierCode) {
        await backchargeService.saveSupplierEmail(doc.supplierCode, email);
      }
    }

    const attachment = {
      content:  pdfFile.buffer,
      filename: pdfFile.originalname || 'backcharge.pdf',
      mimeType: 'application/pdf',
    };

    const result = await sendBackchargeViaEmail(email, supplierName || '', recipientName || '', [attachment], equipment);

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('[Backcharge] sendBackchargeViaEmail:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /update-supplier-email/:supplierCode
 * Updates the saved email for all records sharing the same supplier code.
 */
const updateSupplierEmail = async (req, res) => {
  try {
    const { supplierCode } = req.params;
    const { email }        = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, message: 'Valid email required' });
    }

    const result = await backchargeService.saveSupplierEmail(supplierCode, email);

    res.status(200).json({
      success:       true,
      message:       `Email updated for all records with supplier code ${supplierCode}`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error('[Backcharge] updateSupplierEmail:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /update-backcharge/:id
 * Updates a backcharge report by ID.
 */
const updateBackcharge = async (req, res) => {
  try {
    const report = await backchargeService.updateBackcharge(req.params.id, req.body);

    if (!report) {
      return res.status(404).json({ success: false, message: 'Backcharge report not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Backcharge report updated successfully',
      data:    report,
    });
  } catch (error) {
    console.error('[Backcharge] updateBackcharge:', error);
    res.status(500).json({ success: false, message: 'Error updating backcharge report', error: error.message });
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
      return res.status(404).json({ success: false, message: 'Backcharge report not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Backcharge report deleted successfully',
    });
  } catch (error) {
    console.error('[Backcharge] deleteBackcharge:', error);
    res.status(500).json({ success: false, message: 'Error deleting backcharge report', error: error.message });
  }
};

/**
 * GET /check-latest-backcharge-ref
 * Returns the latest backcharge reference number.
 */
const getLatestBackchargeRef = async (req, res) => {
  try {
    const latestNumber = await backchargeService.getLatestBackchargeRef();

    res.status(200).json({
      success: true,
      message: 'Latest backcharge reference retrieved successfully',
      data:    { latestNumber },
    });
  } catch (error) {
    console.error('[Backcharge] getLatestBackchargeRef:', error);
    res.status(500).json({ success: false, message: 'Error retrieving latest backcharge reference', error: error.message });
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
      return res.status(400).json({ success: false, message: 'Plate number must be at least 2 characters' });
    }

    const equipment = await backchargeService.searchEquipmentByPlate(plateNo);

    res.status(200).json({ success: true, message: 'Equipment search completed', data: equipment });
  } catch (error) {
    console.error('[Backcharge] searchEquipmentByPlate:', error);
    res.status(500).json({ success: false, message: 'Error searching equipment', error: error.message });
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
      return res.status(400).json({ success: false, message: 'Supplier name must be at least 2 characters' });
    }

    const suppliers = await backchargeService.searchSuppliers(name);

    res.status(200).json({ success: true, message: 'Supplier search completed', data: suppliers });
  } catch (error) {
    console.error('[Backcharge] searchSuppliers:', error);
    res.status(500).json({ success: false, message: 'Error searching suppliers', error: error.message });
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
      return res.status(400).json({ success: false, message: 'Site location must be at least 2 characters' });
    }

    const sites = await backchargeService.searchSites(location);

    res.status(200).json({ success: true, message: 'Site search completed', data: sites });
  } catch (error) {
    console.error('[Backcharge] searchSites:', error);
    res.status(500).json({ success: false, message: 'Error searching sites', error: error.message });
  }
};

/**
 * POST /sign/:refNo
 * Identifies the signer by uniqueCode server-side and records the signature.
 * No role is trusted from the client.
 */
const signBackcharge = async (req, res) => {
  try {
    const { refNo }                                                    = req.params;
    const { uniqueCode, signedDate, signedFrom, signedIP, signedDevice, signedLocation } = req.body;

    if (!uniqueCode) {
      return res.status(400).json({ success: false, message: 'uniqueCode is required' });
    }

    if (!signedDate || !signedFrom) {
      return res.status(400).json({ success: false, message: 'signedDate and signedFrom are required' });
    }

    const result = await backchargeService.signBackcharge(refNo, {
      uniqueCode, signedDate, signedFrom, signedIP, signedDevice, signedLocation,
    });

    res.status(200).json(result);
  } catch (error) {
    console.error('[Backcharge] signBackcharge:', error);
    res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to sign backcharge' });
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
};