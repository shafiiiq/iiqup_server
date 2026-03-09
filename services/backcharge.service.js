// services/backcharge.service.js
const Backcharge = require('../models/backcharge.model');
const { createNotification }  = require('./notification.service');
const PushNotificationService = require('../push/notification.push');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sends a notification and a push notification together.
 * @param {object} notifPayload
 * @param {string|Array} recipient
 * @param {string} title
 * @param {string} description
 * @param {string} priority
 * @returns {Promise<void>}
 */
const notify = async (notifPayload, recipient, title, description, priority = 'high') => {
  const notification = await createNotification({ ...notifPayload, recipient, time: new Date() });

  await PushNotificationService.sendGeneralNotification(
    recipient,
    title,
    description,
    priority,
    'normal',
    notification.data._id.toString()
  );
};

/**
 * Converts flat scopeOfWork / scopeLine2Text fields into the structured { combinedText, lines } shape.
 * @param {string} line1
 * @param {string} line2
 * @returns {object}
 */
const buildTextLines = (line1, line2) => ({
  combinedText: (line1 || '') + (line2 ? ' ' + line2 : ''),
  lines: [
    ...(line1 ? [{ lineNumber: 1, text: line1 }] : []),
    ...(line2 ? [{ lineNumber: 2, text: line2 }] : []),
  ],
});

/**
 * Resolves the supplier code for a new backcharge:
 * reuses the code if the supplier already exists, otherwise increments the last code.
 * @param {string} supplierName
 * @returns {Promise<string>}
 */
const resolveSupplierCode = async (supplierName) => {
  const existing = await Backcharge.findOne({
    supplierName: { $regex: new RegExp(`^${supplierName.trim()}$`, 'i') },
    supplierCode: { $ne: null },
  }).select('supplierCode').lean();

  if (existing) return existing.supplierCode;

  const last = await Backcharge.findOne({ supplierCode: { $ne: null } })
    .sort({ createdAt: -1 })
    .select('supplierCode')
    .lean();

  if (last?.supplierCode) {
    const lastNumber = parseInt(last.supplierCode.split('-')[1]) || 0;
    return `SUP-${String(lastNumber + 1).padStart(3, '0')}`;
  }

  return 'SUP-001';
};

/**
 * Looks up the saved email for a supplier code, if one exists.
 * @param {string} supplierCode
 * @returns {Promise<string|null>}
 */
const resolveSupplierMail = async (supplierCode) => {
  if (!supplierCode) return null;

  const record = await Backcharge.findOne({
    supplierCode,
    supplierMail: { $ne: null, $exists: true },
  }).select('supplierMail').lean();

  return record?.supplierMail || null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Read
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns all backcharge reports sorted by creation date descending.
 * @returns {Promise<Array>}
 */
const getAllBackchargeReports = async () => {
  try {
    return await Backcharge.find().sort({ createdAt: -1 }).lean();
  } catch (error) {
    console.error('[BackchargeService] getAllBackchargeReports:', error);
    throw new Error(`Error retrieving backcharge reports: ${error.message}`);
  }
};

/**
 * Returns a backcharge report by its MongoDB ID.
 * @param {string} id
 * @returns {Promise<object>}
 */
const getBackchargeById = async (id) => {
  try {
    return await Backcharge.findById(id).lean();
  } catch (error) {
    console.error('[BackchargeService] getBackchargeById:', error);
    throw new Error(`Error retrieving backcharge report by ID: ${error.message}`);
  }
};

/**
 * Returns a backcharge report by report number.
 * @param {string} reportNo
 * @returns {Promise<object>}
 */
const getBackchargeByReportNo = async (reportNo) => {
  try {
    return await Backcharge.findOne({ reportNo }).lean();
  } catch (error) {
    console.error('[BackchargeService] getBackchargeByReportNo:', error);
    throw new Error(`Error retrieving backcharge report by report number: ${error.message}`);
  }
};

/**
 * Returns a backcharge report by reference number.
 * @param {string} refNo
 * @returns {Promise<object>}
 */
const getBackchargeByRefNo = async (refNo) => {
  try {
    return await Backcharge.findOne({ refNo }).lean();
  } catch (error) {
    console.error('[BackchargeService] getBackchargeByRefNo:', error);
    throw new Error(`Error retrieving backcharge report by ref number: ${error.message}`);
  }
};

/**
 * Returns the numeric part of the latest backcharge refNo (e.g. 193 from "ATE193-09-25").
 * Defaults to 140 if no records exist.
 * @returns {Promise<number>}
 */
const getLatestBackchargeRef = async () => {
  try {
    const latest = await Backcharge.findOne().sort({ createdAt: -1 }).select('refNo').lean();
    if (!latest?.refNo) return 140;

    const parts = latest.refNo.split('-');
    if (parts.length >= 1 && parts[0].startsWith('ATE')) {
      return parseInt(parts[0].replace('ATE', '')) || 140;
    }

    return 140;
  } catch (error) {
    console.error('[BackchargeService] getLatestBackchargeRef:', error);
    throw new Error(`Error retrieving latest backcharge reference: ${error.message}`);
  }
};

/**
 * Returns backcharge reports with pagination and optional filters.
 * @param {number} page
 * @param {number} limit
 * @param {object} filters
 * @returns {Promise<object>}
 */
const getBackchargeReportsWithPagination = async (page = 1, limit = 10, filters = {}) => {
  try {
    const skip  = (page - 1) * limit;
    const query = {};

    if (filters.reportNo)     query.reportNo     = new RegExp(filters.reportNo, 'i');
    if (filters.equipmentType) query.equipmentType = new RegExp(filters.equipmentType, 'i');
    if (filters.supplierName) query.supplierName  = new RegExp(filters.supplierName, 'i');
    if (filters.status)       query.status        = filters.status;

    if (filters.dateFrom || filters.dateTo) {
      query.date = {};
      if (filters.dateFrom) query.date.$gte = new Date(filters.dateFrom);
      if (filters.dateTo)   query.date.$lte = new Date(filters.dateTo);
    }

    const [reports, total] = await Promise.all([
      Backcharge.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Backcharge.countDocuments(query),
    ]);

    return {
      reports,
      pagination: {
        currentPage:  page,
        totalPages:   Math.ceil(total / limit),
        totalReports: total,
        hasNext:      page < Math.ceil(total / limit),
        hasPrev:      page > 1,
      },
    };
  } catch (error) {
    console.error('[BackchargeService] getBackchargeReportsWithPagination:', error);
    throw new Error(`Error retrieving paginated backcharge reports: ${error.message}`);
  }
};

/**
 * Returns aggregate statistics: overall totals, by status, and last 12 months.
 * @returns {Promise<object>}
 */
const getBackchargeStats = async () => {
  try {
    const [overall, byStatus, monthly] = await Promise.all([
      Backcharge.aggregate([{ $group: { _id: null, totalReports: { $sum: 1 }, totalCost: { $sum: '$costSummary.totalCost' }, totalDeductions: { $sum: '$costSummary.approvedDeduction' }, avgCost: { $avg: '$costSummary.totalCost' }, avgDeduction: { $avg: '$costSummary.approvedDeduction' } } }]),
      Backcharge.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Backcharge.aggregate([
        { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, count: { $sum: 1 }, totalCost: { $sum: '$costSummary.totalCost' } } },
        { $sort: { '_id.year': -1, '_id.month': -1 } },
        { $limit: 12 },
      ]),
    ]);

    return {
      overall: overall[0] || { totalReports: 0, totalCost: 0, totalDeductions: 0, avgCost: 0, avgDeduction: 0 },
      byStatus,
      monthly,
    };
  } catch (error) {
    console.error('[BackchargeService] getBackchargeStats:', error);
    throw new Error(`Error retrieving backcharge statistics: ${error.message}`);
  }
};

/**
 * Returns unique equipment records matching a plate number (partial match, max 10).
 * @param {string} plateNo
 * @returns {Promise<Array>}
 */
const searchEquipmentByPlate = async (plateNo) => {
  try {
    const results = await Backcharge.find({ plateNo: new RegExp(plateNo, 'i') })
      .select('plateNo equipmentType model supplierName contactPerson')
      .limit(10).lean();

    return results.reduce((acc, cur) => {
      if (!acc.find(i => i.plateNo === cur.plateNo)) acc.push(cur);
      return acc;
    }, []);
  } catch (error) {
    console.error('[BackchargeService] searchEquipmentByPlate:', error);
    throw new Error(`Error searching equipment: ${error.message}`);
  }
};

/**
 * Returns unique supplier records matching a supplier name (partial match, max 10).
 * @param {string} supplierName
 * @returns {Promise<Array>}
 */
const searchSuppliers = async (supplierName) => {
  try {
    const results = await Backcharge.find({ supplierName: new RegExp(supplierName, 'i') })
      .select('supplierName contactPerson')
      .limit(10).lean();

    return results.reduce((acc, cur) => {
      if (!acc.find(i => i.name === cur.supplierName)) acc.push({ name: cur.supplierName, contactPerson: cur.contactPerson });
      return acc;
    }, []);
  } catch (error) {
    console.error('[BackchargeService] searchSuppliers:', error);
    throw new Error(`Error searching suppliers: ${error.message}`);
  }
};

/**
 * Returns unique site locations matching a partial string (max 10).
 * @param {string} siteLocation
 * @returns {Promise<Array>}
 */
const searchSites = async (siteLocation) => {
  try {
    const results = await Backcharge.find({ siteLocation: new RegExp(siteLocation, 'i') })
      .select('siteLocation')
      .limit(10).lean();

    return results.reduce((acc, cur) => {
      if (!acc.find(i => i.location === cur.siteLocation)) acc.push({ location: cur.siteLocation });
      return acc;
    }, []);
  } catch (error) {
    console.error('[BackchargeService] searchSites:', error);
    throw new Error(`Error searching sites: ${error.message}`);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Write
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a new backcharge report. Auto-generates supplierCode and inherits supplierMail if known.
 * @param {object} data
 * @returns {Promise<object>}
 */
const addBackcharge = async (data) => {
  try {
    const supplierCode = await resolveSupplierCode(data.supplierName);
    const supplierMail = await resolveSupplierMail(supplierCode);

    const newBackcharge = new Backcharge({
      reportNo:       data.reportNo,
      refNo:          data.refNo || 'ATE193-09-25',
      equipmentType:  data.equipmentType,
      plateNo:        data.plateNo,
      model:          data.model,
      supplierName:   data.supplierName,
      contactPerson:  data.contactPerson,
      siteLocation:   data.siteLocation,
      date:           data.date,
      supplierCode,
      supplierMail,
      scopeOfWork:      buildTextLines(data.scopeOfWork, data.scopeLine2Text),
      workshopComments: buildTextLines(data.workshopComments, data.workSummaryLine2),
      sparePartsTable:  data.tableRows || [],
      costSummary: {
        sparePartsCost:    parseFloat(data.sparePartsCost)    || 0,
        labourCharges:     parseFloat(data.labourCharges)     || 0,
        totalCost:         parseFloat(data.totalCost)         || 0,
        approvedDeduction: parseFloat(data.approvedDeduction) || 0,
      },
      signatures: {
        workshopManager:     { signedBy: 'Firoz Khan' },
        purchaseManager:     { signedBy: 'Abdul Malik' },
        operationsManager:   { signedBy: 'Suresh Kanth' },
        authorizedSignatory: {
          signedBy:                  data.authorizedSignatoryName || 'Ahammed Kamal',
          authorizedSignatoryMode:   data.authorizedSignatoryMode || 'CEO',
          authorizedSignatoryName:   data.authorizedSignatoryName || 'Ahammed Kamal',
        },
      },
      status: 'draft',
    });

    return await newBackcharge.save();
  } catch (error) {
    console.error('[BackchargeService] addBackcharge:', error);
    throw new Error(`Error creating backcharge report: ${error.message}`);
  }
};

/**
 * Updates an existing backcharge report by ID.
 * Handles reshaping of nested text/cost/table fields before persisting.
 * @param {string} id
 * @param {object} updateData
 * @returns {Promise<object>}
 */
const updateBackcharge = async (id, updateData) => {
  try {
    if (updateData.scopeOfWork || updateData.scopeLine2Text) {
      updateData.scopeOfWork = buildTextLines(updateData.scopeOfWork, updateData.scopeLine2Text);
      delete updateData.scopeLine2Text;
    }

    if (updateData.workshopComments || updateData.workSummaryLine2) {
      updateData.workshopComments = buildTextLines(updateData.workshopComments, updateData.workSummaryLine2);
      delete updateData.workSummaryLine2;
    }

    if (updateData.sparePartsCost || updateData.labourCharges || updateData.totalCost || updateData.approvedDeduction) {
      updateData.costSummary = {
        sparePartsCost:    parseFloat(updateData.sparePartsCost)    || 0,
        labourCharges:     parseFloat(updateData.labourCharges)     || 0,
        totalCost:         parseFloat(updateData.totalCost)         || 0,
        approvedDeduction: parseFloat(updateData.approvedDeduction) || 0,
      };
      delete updateData.sparePartsCost;
      delete updateData.labourCharges;
      delete updateData.totalCost;
      delete updateData.approvedDeduction;
    }

    if (updateData.tableRows) {
      updateData.sparePartsTable = updateData.tableRows;
      delete updateData.tableRows;
    }

    updateData.updatedAt = new Date();

    return await Backcharge.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
  } catch (error) {
    console.error('[BackchargeService] updateBackcharge:', error);
    throw new Error(`Error updating backcharge report: ${error.message}`);
  }
};

/**
 * Deletes a backcharge report by ID.
 * @param {string} id
 * @returns {Promise<object>}
 */
const deleteBackcharge = async (id) => {
  try {
    return await Backcharge.findByIdAndDelete(id);
  } catch (error) {
    console.error('[BackchargeService] deleteBackcharge:', error);
    throw new Error(`Error deleting backcharge report: ${error.message}`);
  }
};

/**
 * Saves or updates the supplier email for all records sharing the same supplier code.
 * @param {string} supplierCode
 * @param {string} email
 * @returns {Promise<object>}
 */
const saveSupplierEmail = async (supplierCode, email) => {
  try {
    return await Backcharge.updateMany({ supplierCode }, { $set: { supplierMail: email } });
  } catch (error) {
    console.error('[BackchargeService] saveSupplierEmail:', error);
    throw new Error(`Error saving supplier email: ${error.message}`);
  }
};

/**
 * Records a signature on a backcharge document.
 * Resolves the signer's role from their uniqueCode, guards against unauthorised/double-signing,
 * then writes the signature to the record.
 *
 * Role → env var mapping:
 *   workshopManager     → process.env.WORKSHOP_MANAGER
 *   purchaseManager     → process.env.PURCHASE_MANAGER
 *   operationsManager   → process.env.MANAGER
 *   authorizedSignatory → process.env.CEO | process.env.MD
 *
 * @param {string} refNo
 * @param {object} signData
 * @returns {Promise<object>}
 */
const signBackcharge = async (refNo, signData) => {
  const { uniqueCode, signedDate, signedFrom, signedIP = null, signedDevice = null, signedLocation = null } = signData;

  const roleMap = [
    { envKey: process.env.WORKSHOP_MANAGER, field: 'workshopManager',   role: 'WORKSHOP_MANAGER' },
    { envKey: process.env.PURCHASE_MANAGER, field: 'purchaseManager',   role: 'PURCHASE_MANAGER' },
    { envKey: process.env.MANAGER,          field: 'operationsManager', role: 'MANAGER' },
    { envKey: process.env.CEO,              field: 'authorizedSignatory', role: 'CEO' },
    { envKey: process.env.MD,               field: 'authorizedSignatory', role: 'MANAGING_DIRECTOR' },
  ];

  const matched = roleMap.find(r => r.envKey === uniqueCode);
  if (!matched) throw { status: 403, message: 'Unauthorised: your device is not recognised as an authorised signatory for backcharge documents' };

  const backcharge = await Backcharge.findOne({ refNo });
  if (!backcharge) throw { status: 404, message: `Backcharge not found: ${refNo}` };

  if (matched.field === 'authorizedSignatory') {
    const savedMode    = backcharge.signatures?.authorizedSignatory?.authorizedSignatoryMode || 'CEO';
    const expectedRole = savedMode === 'MANAGING DIRECTOR' ? 'MANAGING_DIRECTOR' : 'CEO';
    if (matched.role !== expectedRole) throw { status: 403, message: `This document requires ${savedMode} signature, not ${matched.role}` };
  }

  if (backcharge.signatures?.[matched.field]?.signed) {
    throw { status: 409, message: `This position (${matched.role}) has already been signed` };
  }

  const updated = await Backcharge.findOneAndUpdate(
    { refNo },
    {
      [`signatures.${matched.field}.signed`]:          true,
      [`signatures.${matched.field}.signedBy`]:        uniqueCode,
      [`signatures.${matched.field}.signedDate`]:      signedDate,
      [`signatures.${matched.field}.signedFrom`]:      signedFrom,
      [`signatures.${matched.field}.signedIP`]:        signedIP,
      [`signatures.${matched.field}.signedDevice`]:    signedDevice,
      [`signatures.${matched.field}.signedLocation`]:  signedLocation,
      $push: {
        approvalTrail: { signedBy: uniqueCode, role: matched.role, action: 'signed', signedDate: new Date(), comments: `${matched.role} signed the backcharge document` },
      },
    },
    { new: true }
  );
  if (!updated) throw { status: 500, message: 'Failed to update backcharge record' };

  const nextStepMap = {
    WORKSHOP_MANAGER: {
      title:       `Purchase Manager Approval Needed - ${refNo}`,
      description: `Workshop Manager signed backcharge ${refNo}. Purchase Manager approval needed.`,
      sourceId:    'backcharge_approval',
      recipient:   JSON.parse(process.env.OFFICE_HERO),
    },
    PURCHASE_MANAGER: {
      title:       `Manager Approval Needed - ${refNo}`,
      description: `Purchase Manager signed backcharge ${refNo}. Manager approval needed.`,
      sourceId:    'backcharge_approval',
      recipient:   JSON.parse(process.env.OFFICE_HERO),
    },
    MANAGER: {
       title:       `${updated.signatures?.authorizedSignatory?.authorizedSignatoryMode || 'CEO'} Approval Needed - ${refNo}`,
      description: `Manager signed backcharge ${refNo}. ${updated.signatures?.authorizedSignatory?.authorizedSignatoryMode || 'CEO'} approval needed.`,
      sourceId:    updated.signatures?.authorizedSignatory?.authorizedSignatoryMode === 'MANAGING DIRECTOR'
        ? 'md_approval'
        : 'ceo_approval',
       recipient:   JSON.parse(process.env.OFFICE_HERO),
     },
    CEO: {
      title:       `Backcharge Signed & Ready - ${refNo}`,
      description: `CEO signed backcharge ${refNo}. All signatures complete.`,
      sourceId:    'backcharge_final',
       recipient:   JSON.parse(process.env.OFFICE_MAIN),
    },
     MANAGING_DIRECTOR: {
      title:       `Backcharge Signed & Ready - ${refNo}`,
      description: `MD signed backcharge ${refNo}. All signatures complete.`,
      sourceId:    'backcharge_final',
      recipient:   JSON.parse(process.env.OFFICE_MAIN),
     },
  };

  const notifConfig = nextStepMap[matched.role];

  if (notifConfig) {
   const { recipient, title, description, sourceId } = notifConfig;

   await notify(
     { title, description, priority: 'high', sourceId },
     recipient,
      title,
      description
    );
  }

  return { status: 200, message: `${matched.role} signature recorded successfully`, data: updated, role: matched.role };
};

/**
 * Returns all backcharge documents where the given uniqueCode has NOT yet signed
 * their corresponding role field, but the previous role in the chain has signed.
 * @param {string} uniqueCode
 * @returns {Promise<Array>}
 */
const getPendingSignatures = async (uniqueCode) => {
  try {
    const roleMap = [
      { envKey: process.env.WORKSHOP_MANAGER, field: 'workshopManager',     prevField: null                },
      { envKey: process.env.PURCHASE_MANAGER, field: 'purchaseManager',     prevField: 'workshopManager'   },
      { envKey: process.env.MANAGER,          field: 'operationsManager',   prevField: 'purchaseManager'   },
      { envKey: process.env.CEO,              field: 'authorizedSignatory', prevField: 'operationsManager' },
      { envKey: process.env.MD,               field: 'authorizedSignatory', prevField: 'operationsManager' },
    ];

    const matched = roleMap.find(r => r.envKey === uniqueCode);
    if (!matched) return [];

    // Build query: their field is not yet signed
    const query = { [`signatures.${matched.field}.signed`]: { $ne: true } };

    // If there's a previous step, that step must already be signed
    if (matched.prevField) {
      query[`signatures.${matched.prevField}.signed`] = true;
    }

    // CEO/MD: also filter by authorizedSignatoryMode matching their role
    if (matched.envKey === process.env.CEO) {
      query['signatures.authorizedSignatory.authorizedSignatoryMode'] = { $nin: ['MANAGING DIRECTOR'] };
    }
    if (matched.envKey === process.env.MD) {
      query['signatures.authorizedSignatory.authorizedSignatoryMode'] = 'MANAGING DIRECTOR';
    }

    return await Backcharge.find(query)
      .select('refNo reportNo supplierName equipmentType plateNo date signatures')
      .sort({ createdAt: -1 })
      .lean();

  } catch (error) {
    console.error('[BackchargeService] getPendingSignatures:', error);
    throw new Error(`Error fetching pending signatures: ${error.message}`);
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
  getLatestBackchargeRef,
  getBackchargeReportsWithPagination,
  getBackchargeStats,
  searchEquipmentByPlate,
  searchSuppliers,
  searchSites,
  addBackcharge,
  updateBackcharge,
  deleteBackcharge,
  saveSupplierEmail,
  signBackcharge,
  getPendingSignatures
};