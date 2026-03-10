// controllers/equipment.controller.js
const path               = require('path');
const { putObject }      = require('../aws/s3.aws');
const equipmentServices  = require('../services/equipment.service');
const equipmentModel     = require('../models/equipment.model');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const paginationShape = (result) => ({
  currentPage: result.currentPage,
  totalPages:  result.totalPages,
  totalCount:  result.totalCount,
  hasMore:     result.hasNextPage,
});

// ─────────────────────────────────────────────────────────────────────────────
// CRUD Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /add-equipment
 * Creates a new equipment record.
 */
const addEquipment = async (req, res) => {
  try {
    const result = await equipmentServices.insertEquipment(req.body);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Equipment] addEquipment:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * GET /get-equipments
 * Returns a paginated list of equipment with an optional hired filter.
 */
const getEquipments = async (req, res) => {
  try {
    const { page = 1, limit = 20, hired, status } = req.query;
    
    const result = await equipmentServices.fetchEquipments(parseInt(page), parseInt(limit), hired, status);

    res.status(200).json({
      status:     200,
      ok:         true,
      data:       result.equipments,
      pagination: paginationShape(result),
    });
  } catch (error) {
    console.error('[Equipment] getEquipments:', error);
    res.status(500).json({ status: 500, ok: false, message: error.message });
  }
};

/**
 * GET /get-equipment/:regNo
 * Returns a single equipment record by registration number.
 */
const getEquipmentsByReg = async (req, res) => {
  try {
    const { regNo } = req.params;
    const result    = await equipmentServices.fetchEquipmentByReg(regNo);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Equipment] getEquipmentsByReg:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * GET /equipment-images/:regNo
 * Returns a lightweight equipment record by registration number.
 */
const getEquipmentImages = async (req, res) => {
  try {
    const { regNo } = req.params;

    if (!regNo) {
      return res.status(400).json({ success: false, message: 'Equipment regNo is required' });
    }

    const result = await equipmentServices.getEquipmentImages(regNo);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Equipment] getEquipmentImages:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /update-equipment/:regNo
 * Updates an equipment record by registration number.
 */
const updateEquipments = async (req, res) => {
  try {
    const { regNo }  = req.params;
    const updateData = req.body;

    const result = await equipmentServices.updateEquipment(regNo, updateData);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Equipment] updateEquipments:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /delete-equipment/:regNo
 * Deletes an equipment record by registration number.
 */
const deleteEquipments = async (req, res) => {
  try {
    const { regNo } = req.params;
    const result    = await equipmentServices.deleteEquipment(regNo);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Equipment] deleteEquipments:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /status-update/:id
 * Updates the status field of an equipment record by ID.
 */
const updateStatus = async (req, res) => {
  try {
    const { id }     = req.params;
    const updateData = req.body;

    const result = await equipmentServices.changeStatus(id, updateData);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Equipment] updateStatus:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Search & Filter Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /search-equipments
 * Full-text search across equipment fields with pagination.
 */
const searchEquipments = async (req, res) => {
  try {
    const { searchTerm, page = 1, limit = 20, searchField = 'all', hired } = req.body;

    if (!searchTerm || searchTerm.trim() === '') {
      return res.status(400).json({ status: 400, ok: false, message: 'Search term is required' });
    }

    const result = await equipmentServices.searchEquipments(
      searchTerm.trim(),
      parseInt(page),
      parseInt(limit),
      searchField,
      hired,
    );

    res.status(200).json({
      status:     200,
      ok:         true,
      data:       result.equipments,
      pagination: paginationShape(result),
      searchTerm,
    });
  } catch (error) {
    console.error('[Equipment] searchEquipments:', error);
    res.status(500).json({ status: 500, ok: false, message: error.message });
  }
};

/**
 * GET /get-equipments-by-status
 * Returns paginated equipment filtered by status and optional hired flag.
 */
const getEquipmentsByStatus = async (req, res) => {
  try {
    const { status, page = 1, limit = 20, hired } = req.query;

    const result = await equipmentServices.fetchEquipmentsByStatus(
      status,
      parseInt(page),
      parseInt(limit),
      hired,
    );

    res.status(200).json({
      status:     200,
      ok:         true,
      data:       result.equipments,
      pagination: paginationShape(result),
    });
  } catch (error) {
    console.error('[Equipment] getEquipmentsByStatus:', error);
    res.status(500).json({ status: 500, ok: false, message: error.message });
  }
};

/**
 * GET /equipment-stats
 * Returns aggregate counts and statistics for equipment.
 */
const getEquipmentStats = async (req, res) => {
  try {
    const { hired } = req.query;
    const result    = await equipmentServices.fetchEquipmentStats(hired);

    res.status(200).json({
      status: 200,
      ok:     true,
      data:   result,
    });
  } catch (error) {
    console.error('[Equipment] getEquipmentStats:', error);
    res.status(500).json({ status: 500, ok: false, message: error.message });
  }
};

/**
 * GET /equipment-count
 * Returns the total count of equipment matching optional search/filter params.
 */
const getEquipmentCount = async (req, res) => {
  try {
    const { searchTerm, searchField = 'all', hired } = req.query;

    let query = {};
    if (hired === 'hired')    query.hired = true;
    else if (hired === 'own') query.hired = false;

    if (searchTerm?.trim()) {
      if (searchField === 'all') {
        query.$or = [
          { machine:           { $regex: searchTerm, $options: 'i' } },
          { regNo:             { $regex: searchTerm, $options: 'i' } },
          { brand:             { $regex: searchTerm, $options: 'i' } },
          { company:           { $regex: searchTerm, $options: 'i' } },
          { status:            { $regex: searchTerm, $options: 'i' } },
          { site:              { $regex: searchTerm, $options: 'i' } },
          { 'certificationBody.operatorName': { $regex: searchTerm, $options: 'i' } },
        ];
        if (!isNaN(searchTerm)) query.$or.push({ year: parseInt(searchTerm) });
      } else if (searchField === 'site') {
        query.site = { $regex: searchTerm, $options: 'i' };
      } else {
        query[searchField] = { $regex: searchTerm, $options: 'i' };
      }
    }

    const count = await equipmentModel.countDocuments(query);

    res.status(200).json({ status: 200, ok: true, count });
  } catch (error) {
    console.error('[Equipment] getEquipmentCount:', error);
    res.status(500).json({ status: 500, ok: false, message: error.message });
  }
};

/**
 * GET /get-sites
 * Returns a list of all unique site names across equipment records.
 */
const getSites = async (req, res) => {
  try {
    const result = await equipmentServices.fetchUniqueSites();

    res.status(200).json({ status: 200, ok: true, data: result });
  } catch (error) {
    console.error('[Equipment] getSites:', error);
    res.status(500).json({ status: 500, ok: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Image Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /add-equipment-image
 * Generates pre-signed S3 upload URLs and saves image metadata for an equipment record.
 */
const addEquipmentImage = async (req, res) => {
  try {
    const { equipmentNo, files } = req.body;

    if (!equipmentNo) {
      return res.status(400).json({ success: false, message: 'Equipment number is required' });
    }

    if (!files?.length) {
      return res.status(400).json({ success: false, message: 'At least one file is required' });
    }

    const filesWithUploadData = await Promise.all(
      files.map(async (file, index) => {
        const imageLabel    = file.label || 'Unlabeled';
        const ext           = path.extname(file.fileName);
        const finalFilename = `${equipmentNo}-${Date.now()}-${index}${ext}`;
        const s3Key         = `equipment-images/${equipmentNo}/${finalFilename}`;
        const uploadUrl     = await putObject(file.fileName, s3Key, file.mimeType);

        const saveResult = await equipmentServices.addEquipmentImage(
          equipmentNo, s3Key, imageLabel, finalFilename, file.mimeType,
        );

        if (!saveResult.success) {
          throw new Error(`Failed to save image metadata: ${saveResult.message}`);
        }

        return {
          fileName:     finalFilename,
          originalName: file.fileName,
          filePath:     s3Key,
          mimeType:     file.mimeType,
          type:         file.mimeType.startsWith('video/') ? 'video' : 'photo',
          uploadUrl,
          uploadDate:   new Date(),
          label:        imageLabel,
          dbSaveResult: saveResult,
        };
      }),
    );

    res.status(200).json({
      status:  200,
      message: 'Pre-signed URLs generated and metadata saved',
      data:    { uploadData: filesWithUploadData },
    });
  } catch (error) {
    console.error('[Equipment] addEquipmentImage:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * POST /bulk-equipment-images
 * Returns images for multiple equipment records in a single request (max 50).
 */
const getBulkEquipmentImages = async (req, res) => {
  try {
    const { regNos } = req.body;

    if (!regNos || !Array.isArray(regNos) || regNos.length === 0) {
      return res.status(400).json({ success: false, message: 'Array of equipment regNos is required' });
    }

    if (regNos.length > 50) {
      return res.status(400).json({ success: false, message: 'Maximum 50 equipment regNos allowed per request' });
    }

    const result = await equipmentServices.getBulkEquipmentImages(regNos);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Equipment] getBulkEquipmentImages:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Status Change Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /change-equipment-status
 * Records a status transition (e.g. active → maintenance) with audit metadata.
 */
const changeEquipmentStatus = async (req, res) => {
  try {
    const {
      equipmentId, regNo, machine,
      previousStatus, newStatus,
      month, year, time, remarks,
    } = req.body;

    if (!equipmentId || !regNo || !machine || !previousStatus || !newStatus || !month || !year || !time) {
      return res.status(400).json({
        status:  400,
        ok:      false,
        message: 'Missing required fields: equipmentId, regNo, machine, previousStatus, newStatus, month, year, time',
      });
    }

    if (previousStatus === newStatus) {
      return res.status(400).json({ status: 400, ok: false, message: 'Previous status and new status cannot be the same' });
    }

    const result = await equipmentServices.changeEquipmentStatus({
      equipmentId, regNo, machine,
      previousStatus, newStatus,
      month, year, time,
      remarks: remarks || '',
    });

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Equipment] changeEquipmentStatus:', error);
    res.status(500).json({ status: 500, ok: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Mobilization Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /mobilize-equipment
 * Mobilizes an equipment unit to a site or client company with optional operator assignment.
 */
const mobilizeEquipment = async (req, res) => {
  try {
    const {
      equipmentId, regNo, machine, site, operator, operatorId,
      withOperator, deployType, clientCompany, selectedDate,
      month, year, time, remarks,
      isOneDayMob, demobDate, demobTime, demobRemarks,
    } = req.body;

    if (!equipmentId || !regNo || !machine || !month || !year || !time) {
      return res.status(400).json({
        status:  400,
        ok:      false,
        message: 'Missing required fields: equipmentId, regNo, machine, month, year, time',
      });
    }

    if (deployType === 'company' && !clientCompany) {
      return res.status(400).json({ status: 400, ok: false, message: 'clientCompany is required when deployType is company' });
    }

    if (deployType !== 'company' && !site) {
      return res.status(400).json({ status: 400, ok: false, message: 'site is required when deployType is site' });
    }

    if (withOperator && !operator) {
      return res.status(400).json({ status: 400, ok: false, message: 'Operator is required when withOperator is true' });
    }

    const result = await equipmentServices.mobilizeEquipment({
      equipmentId, regNo, machine, site, operator, operatorId,
      withOperator:  withOperator  || false,
      deployType:    deployType    || 'site',
      clientCompany: clientCompany || '',
      selectedDate:  selectedDate  || null,
      month, year, time,
      remarks: remarks || '',
      isOneDayMob:  isOneDayMob  || false,
      demobDate:    demobDate    || null,     
      demobTime:    demobTime    || '',     
      demobRemarks: demobRemarks || '',       

    });

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Equipment] mobilizeEquipment:', error);
    res.status(500).json({ status: 500, ok: false, message: error.message });
  }
};

/**
 * POST /demobilize-equipment
 * Demobilizes an equipment unit and records the event.
 */
const demobilizeEquipment = async (req, res) => {
  try {
    const {
      equipmentId, regNo, machine,
      selectedDate, month, year, time, remarks,
    } = req.body;

    if (!equipmentId || !regNo || !machine || !month || !year || !time) {
      return res.status(400).json({
        status:  400,
        ok:      false,
        message: 'Missing required fields: equipmentId, regNo, machine, month, year, time',
      });
    }

    const result = await equipmentServices.demobilizeEquipment({
      equipmentId, regNo, machine,
      selectedDate: selectedDate || null,
      month, year, time,
      remarks: remarks || '',
    });

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Equipment] demobilizeEquipment:', error);
    res.status(500).json({ status: 500, ok: false, message: error.message });
  } 
};

/** 
 * GET /mobilization-history/:equipmentId
 * Returns paginated mobilization history for a specific equipment unit.
 */
const getMobilizationHistory = async (req, res) => {
  try {
    const { equipmentId }          = req.params;
    const { page = 1, limit = 20 } = req.query;

    if (!equipmentId) {
      return res.status(400).json({ status: 400, ok: false, message: 'Equipment ID is required' });
    }

    const result = await equipmentServices.getMobilizationHistory(
      parseInt(equipmentId),
      parseInt(page),
      parseInt(limit),
    );

    res.status(200).json({
      status:     200,
      ok:         true,
      data:       result.history,
      pagination: paginationShape(result),
    });
  } catch (error) {
    console.error('[Equipment] getMobilizationHistory:', error);
    res.status(500).json({ status: 500, ok: false, message: error.message });
  }
};

/**
 * GET /all-mobilizations
 * Returns all mobilization records across all equipment.
 */
const getAllMobilizations = async (req, res) => {
  try {
    const result = await equipmentServices.fetchAllMobilizations();

    res.status(200).json({ status: 200, ok: true, data: result });
  } catch (error) {
    console.error('[Equipment] getAllMobilizations:', error);
    res.status(500).json({ status: 500, ok: false, message: error.message });
  }
};

/**
 * GET /filtered-mobilizations
 * Returns mobilization records filtered by date range, time window, or preset period.
 */
const getFilteredMobilizations = async (req, res) => {
  try {
    const {
      filterType, startDate, endDate, months,
      specificTime, startTime, endTime,
    } = req.query;

    if (!filterType) {
      return res.status(400).json({
        status:  400,
        ok:      false,
        message: 'filterType is required (daily, yesterday, weekly, monthly, yearly, months, custom, single)',
      });
    }

    if (filterType === 'custom' && (!startDate || !endDate)) {
      return res.status(400).json({ status: 400, ok: false, message: 'startDate and endDate are required for custom range' });
    }

    if (filterType === 'single' && !startDate) {
      return res.status(400).json({ status: 400, ok: false, message: 'Date is required for single date filter' });
    }

    if (filterType === 'months' && !months) {
      return res.status(400).json({ status: 400, ok: false, message: 'months is required for months filter type' });
    }

    if (startTime && endTime && startTime > endTime) {
      return res.status(400).json({ status: 400, ok: false, message: 'startTime must be before endTime' });
    }

    const result = await equipmentServices.fetchFilteredMobilizations(
      filterType, startDate, endDate, months, specificTime, startTime, endTime,
    );

    res.status(200).json({ status: 200, ok: true, data: result, count: result.length });
  } catch (error) {
    console.error('[Equipment] getFilteredMobilizations:', error);
    res.status(500).json({ status: 500, ok: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Replacement Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /replace-operator
 * Replaces the assigned operator on a deployed equipment unit.
 */
const replaceOperator = async (req, res) => {
  try {
    const {
      equipmentId, regNo, machine,
      currentOperator, currentOperatorId,
      replacedOperator, replacedOperatorId,
      selectedDate, month, year, time, remarks,
    } = req.body;

    if (
      !equipmentId || !regNo || !machine ||
      !currentOperator || !replacedOperator || !replacedOperatorId ||
      !month || !year || !time
    ) {
      return res.status(400).json({
        status:  400,
        ok:      false,
        message: 'Missing required fields: equipmentId, regNo, machine, currentOperator, currentOperatorId, replacedOperator, replacedOperatorId, month, year, time',
      });
    }

    const result = await equipmentServices.replaceOperator({
      equipmentId, regNo, machine,
      currentOperator, currentOperatorId,
      replacedOperator, replacedOperatorId,
      selectedDate: selectedDate || null,
      month, year, time,
      remarks: remarks || '',
    });

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Equipment] replaceOperator:', error);
    res.status(500).json({ status: 500, ok: false, message: error.message });
  }
};

/**
 * POST /replace-equipment
 * Swaps one deployed equipment unit with another.
 */
const replaceEquipment = async (req, res) => {
  try {
    const {
      equipmentId, regNo, machine,
      replacedEquipmentId, replacedEquipmentRegNo, replacedEquipmentMachine,
      newSiteForReplaced, selectedDate, month, year, time, remarks,
    } = req.body;

    if (
      !equipmentId || !regNo || !machine ||
      !replacedEquipmentId || !replacedEquipmentRegNo || !replacedEquipmentMachine ||
      !month || !year || !time
    ) {
      return res.status(400).json({
        status:  400,
        ok:      false,
        message: 'Missing required fields: equipmentId, regNo, machine, replacedEquipmentId, replacedEquipmentRegNo, replacedEquipmentMachine, month, year, time',
      });
    }

    const result = await equipmentServices.replaceEquipment({
      equipmentId, regNo, machine,
      replacedEquipmentId, replacedEquipmentRegNo, replacedEquipmentMachine,
      newSiteForReplaced: newSiteForReplaced || null,
      selectedDate:       selectedDate       || null,
      month, year, time,
      remarks: remarks || '',
    });

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Equipment] replaceEquipment:', error);
    res.status(500).json({ status: 500, ok: false, message: error.message });
  }
};

/**
 * GET /replacement-history/:equipmentId
 * Returns paginated replacement history for a specific equipment unit.
 */
const getReplacementHistory = async (req, res) => {
  try {
    const { equipmentId }                = req.params;
    const { page = 1, limit = 20, type } = req.query;

    if (!equipmentId) {
      return res.status(400).json({ status: 400, ok: false, message: 'Equipment ID is required' });
    }

    const result = await equipmentServices.getReplacementHistory(
      parseInt(equipmentId),
      parseInt(page),
      parseInt(limit),
      type,
    );

    res.status(200).json({
      status:     200,
      ok:         true,
      data:       result.history,
      pagination: paginationShape(result),
    });
  } catch (error) {
    console.error('[Equipment] getReplacementHistory:', error);
    res.status(500).json({ status: 500, ok: false, message: error.message });
  }
};

/**
 * GET /all-replacements
 * Returns all replacement records across all equipment.
 */
const getAllReplacements = async (req, res) => {
  try {
    const result = await equipmentServices.fetchAllReplacements();

    res.status(200).json({ status: 200, ok: true, data: result });
  } catch (error) {
    console.error('[Equipment] getAllReplacements:', error);
    res.status(500).json({ status: 500, ok: false, message: error.message });
  }
};

/**
 * GET /filtered-replacements
 * Returns replacement records filtered by date range or preset period.
 */
const getFilteredReplacements = async (req, res) => {
  try {
    const { filterType, startDate, endDate, months } = req.query;

    if (!filterType) {
      return res.status(400).json({
        status:  400,
        ok:      false,
        message: 'filterType is required (daily, yesterday, weekly, monthly, yearly, months, custom)',
      });
    }

    if (filterType === 'custom' && (!startDate || !endDate)) {
      return res.status(400).json({ status: 400, ok: false, message: 'startDate and endDate are required for custom range' });
    }

    if (filterType === 'months' && !months) {
      return res.status(400).json({ status: 400, ok: false, message: 'months is required for months filter type' });
    }

    const result = await equipmentServices.fetchFilteredReplacements(filterType, startDate, endDate, months);

    res.status(200).json({ status: 200, ok: true, data: result, count: result.length });
  } catch (error) {
    console.error('[Equipment] getFilteredReplacements:', error);
    res.status(500).json({ status: 500, ok: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // CRUD
  addEquipment,
  getEquipments,
  getEquipmentsByReg,
  getEquipmentImages,
  updateEquipments,
  deleteEquipments,
  updateStatus,
  // Search & Filter
  searchEquipments,
  getEquipmentsByStatus,
  getEquipmentStats,
  getEquipmentCount,
  getSites,
  // Images
  addEquipmentImage,
  getBulkEquipmentImages,
  // Status Change
  changeEquipmentStatus,
  // Mobilization
  mobilizeEquipment,
  demobilizeEquipment,
  getMobilizationHistory,
  getAllMobilizations,
  getFilteredMobilizations,
  // Replacements
  replaceOperator,
  replaceEquipment,
  getReplacementHistory,
  getAllReplacements,
  getFilteredReplacements,
};