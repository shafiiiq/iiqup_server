const logger = require('../../shared/logger/logger');

const HTTP = require('../../shared/constants/httpStatus.constant.js');
const { sendSuccess, sendError } = require('../../shared/response/response.util');
// controllers/equipment.controller.js
const path = require('path');
const { putObject } = require('../../config/aws/s3.aws');
const equipmentServices = require('./equipment.service');
const equipmentModel = require('./equipment.model');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const paginationShape = (result) => ({
  currentPage: result.currentPage,
  totalPages: result.totalPages,
  totalCount: result.totalCount,
  hasMore: result.hasNextPage,
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

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Equipment] addEquipment:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

/**
 * GET /get-equipments
 * Returns a paginated list of equipment with an optional hired filter.
 */
const getEquipments = async (req, res) => {
  try {
    const { hired, status } = req.query;
    const statusFilter = Array.isArray(status)
      ? status
      : status
        ? [status]
        : null;

    const result = await equipmentServices.fetchEquipments(
      req.pagination,
      hired,
      statusFilter
    );

    sendSuccess(res, {
      status: HTTP.OK,
      ok: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('[Equipment] getEquipments:', error);
    sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

/**
 * GET /get-equipment/:regNo
 * Returns a single equipment record by registration number.
 */
const getEquipmentsByReg = async (req, res) => {
  try {
    const { regNo } = req.params;
    const result = await equipmentServices.fetchEquipmentByReg(regNo);

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Equipment] getEquipmentsByReg:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
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
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'Equipment regNo is required' });
    }

    const result = await equipmentServices.getEquipmentImages(regNo);

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Equipment] getEquipmentImages:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

/**
 * PUT /update-equipment/:regNo
 * Updates an equipment record by registration number.
 */
const updateEquipments = async (req, res) => {
  try {
    const { regNo } = req.params;
    const updateData = req.body;

    const result = await equipmentServices.updateEquipment(regNo, updateData);

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Equipment] updateEquipments:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

/**
 * DELETE /delete-equipment/:regNo
 * Deletes an equipment record by registration number.
 */
const deleteEquipments = async (req, res) => {
  try {
    const { regNo } = req.params;
    const result = await equipmentServices.deleteEquipment(regNo);

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Equipment] deleteEquipments:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

/**
 * PUT /status-update/:id
 * Updates the status field of an equipment record by ID.
 */
const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const result = await equipmentServices.changeStatus(id, updateData);

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Equipment] updateStatus:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
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
    const { searchTerm, searchField = 'all', hired } = req.body;

    if (!searchTerm || searchTerm.trim() === '') {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ status: HTTP.BAD_REQUEST, ok: false, message: 'Search term is required' });
    }

    const result = await equipmentServices.searchEquipments(
      searchTerm.trim(),
      req.pagination,
      searchField,
      hired
    );

    sendSuccess(res, {
      status: HTTP.OK,
      ok: true,
      data: result.data,
      pagination: result.pagination,
      searchTerm,
    });
  } catch (error) {
    logger.error('[Equipment] searchEquipments:', error);
    sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

/**
 * GET /get-equipments-by-status
 * Returns paginated equipment filtered by status and optional hired flag.
 */
const getEquipmentsByStatus = async (req, res) => {
  try {
    const { status, hired } = req.query;

    const result = await equipmentServices.fetchEquipmentsByStatus(
      status,
      req.pagination,
      hired
    );

    sendSuccess(res, {
      status: HTTP.OK,
      ok: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('[Equipment] getEquipmentsByStatus:', error);
    sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

/**
 * GET /equipment-stats
 * Returns aggregate counts and statistics for equipment.
 */
const getEquipmentStats = async (req, res) => {
  try {
    const { hired } = req.query;
    const result = await equipmentServices.fetchEquipmentStats(hired);

    sendSuccess(res, {
      status: HTTP.OK,
      ok: true,
      data: result,
    });
  } catch (error) {
    logger.error('[Equipment] getEquipmentStats:', error);
    sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
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
    if (hired === 'hired') query.hired = true;
    else if (hired === 'own') query.hired = false;

    if (searchTerm?.trim()) {
      if (searchField === 'all') {
        query.$or = [
          { machine: { $regex: searchTerm, $options: 'i' } },
          { regNo: { $regex: searchTerm, $options: 'i' } },
          { brand: { $regex: searchTerm, $options: 'i' } },
          { company: { $regex: searchTerm, $options: 'i' } },
          { status: { $regex: searchTerm, $options: 'i' } },
          { site: { $regex: searchTerm, $options: 'i' } },
          {
            'certificationBody.operatorName': {
              $regex: searchTerm,
              $options: 'i',
            },
          },
        ];
        if (!isNaN(searchTerm)) query.$or.push({ year: parseInt(searchTerm) });
      } else if (searchField === 'site') {
        query.site = { $regex: searchTerm, $options: 'i' };
      } else {
        query[searchField] = { $regex: searchTerm, $options: 'i' };
      }
    }

    const count = await equipmentModel.countDocuments(query);

    sendSuccess(res, { status: HTTP.OK, ok: true, count });
  } catch (error) {
    logger.error('[Equipment] getEquipmentCount:', error);
    sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

/**
 * GET /get-sites
 * Returns a list of all unique site names across equipment records.
 */
const getSites = async (req, res) => {
  try {
    const result = await equipmentServices.fetchUniqueSites();

    sendSuccess(res, { status: HTTP.OK, ok: true, data: result });
  } catch (error) {
    logger.error('[Equipment] getSites:', error);
    sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
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
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'Equipment number is required' });
    }

    if (!files?.length) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'At least one file is required' });
    }

    const filesWithUploadData = await Promise.all(
      files.map(async (file, index) => {
        const imageLabel = file.label || 'Unlabeled';
        const ext = path.extname(file.fileName);
        const finalFilename = `${equipmentNo}-${Date.now()}-${index}${ext}`;
        const s3Key = `equipment-images/${equipmentNo}/${finalFilename}`;
        const uploadUrl = await putObject(file.fileName, s3Key, file.mimeType);

        const saveResult = await equipmentServices.addEquipmentImage(
          equipmentNo,
          s3Key,
          imageLabel,
          finalFilename,
          file.mimeType
        );

        if (!saveResult.success) {
          throw new Error(
            `Failed to save image metadata: ${saveResult.message}`
          );
        }

        return {
          fileName: finalFilename,
          originalName: file.fileName,
          filePath: s3Key,
          mimeType: file.mimeType,
          type: file.mimeType.startsWith('video/') ? 'video' : 'photo',
          uploadUrl,
          uploadDate: new Date(),
          label: imageLabel,
          dbSaveResult: saveResult,
        };
      })
    );

    sendSuccess(res, {
      status: HTTP.OK,
      message: 'Pre-signed URLs generated and metadata saved',
      data: { uploadData: filesWithUploadData },
    });
  } catch (error) {
    logger.error('[Equipment] addEquipmentImage:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
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
      return sendError(res, {
        success: false,
        message: 'Array of equipment regNos is required',
      });
    }

    if (regNos.length > 50) {
      return sendError(res, {
        success: false,
        message: 'Maximum 50 equipment regNos allowed per request',
      });
    }

    const result = await equipmentServices.getBulkEquipmentImages(regNos);

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Equipment] getBulkEquipmentImages:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
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
      equipmentId,
      regNo,
      machine,
      previousStatus,
      newStatus,
      month,
      year,
      time,
      remarks,
    } = req.body;

    if (
      !equipmentId ||
      !regNo ||
      !machine ||
      !previousStatus ||
      !newStatus ||
      !month ||
      !year ||
      !time
    ) {
      return sendError(res, {
        status: HTTP.BAD_REQUEST,
        ok: false,
        message:
          'Missing required fields: equipmentId, regNo, machine, previousStatus, newStatus, month, year, time',
      });
    }

    if (previousStatus === newStatus) {
      return sendError(res, {
        status: HTTP.BAD_REQUEST,
        ok: false,
        message: 'Previous status and new status cannot be the same',
      });
    }

    const result = await equipmentServices.changeEquipmentStatus({
      equipmentId,
      regNo,
      machine,
      previousStatus,
      newStatus,
      month,
      year,
      time,
      remarks: remarks || '',
    });

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Equipment] changeEquipmentStatus:', error);
    sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
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
      equipmentId,
      regNo,
      machine,
      site,
      operators,
      withOperator,
      deployType,
      clientCompany,
      selectedDate,
      month,
      year,
      time,
      remarks,
      isOneDayMob,
      demobDate,
      demobTime,
      demobRemarks,
      location,
      rentRate,
    } = req.body;

    if (!equipmentId || !regNo || !machine || !month || !year || !time) {
      return sendError(res, {
        status: HTTP.BAD_REQUEST,
        ok: false,
        message:
          'Missing required fields: equipmentId, regNo, machine, month, year, time',
      });
    }

    if (deployType === 'company' && !clientCompany) {
      return sendError(res, {
        status: HTTP.BAD_REQUEST,
        ok: false,
        message: 'clientCompany is required when deployType is company',
      });
    }

    if (deployType !== 'company' && !site) {
      return sendError(res, {
        status: HTTP.BAD_REQUEST,
        ok: false,
        message: 'site is required when deployType is site',
      });
    }

    if (withOperator && (!operators || !operators.length)) {
      return sendError(res, {
        status: HTTP.BAD_REQUEST,
        ok: false,
        message: 'At least one operator is required when withOperator is true',
      });
    }

    const result = await equipmentServices.mobilizeEquipment({
      equipmentId,
      regNo,
      machine,
      site,
      operators: operators || [],
      withOperator: withOperator || false,
      deployType: deployType || 'site',
      clientCompany: clientCompany || '',
      selectedDate: selectedDate || null,
      month,
      year,
      time,
      remarks: remarks || '',
      isOneDayMob: isOneDayMob || false,
      demobDate: demobDate || null,
      demobTime: demobTime || '',
      demobRemarks: demobRemarks || '',
      location: location || null,
      rentRate: rentRate || null,
    });

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Equipment] mobilizeEquipment:', error);
    sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

/**
 * POST /demobilize-equipment
 * Demobilizes an equipment unit and records the event.
 */
const demobilizeEquipment = async (req, res) => {
  try {
    const {
      equipmentId,
      regNo,
      machine,
      selectedDate,
      month,
      year,
      time,
      remarks,
    } = req.body;

    if (!equipmentId || !regNo || !machine || !month || !year || !time) {
      return sendError(res, {
        status: HTTP.BAD_REQUEST,
        ok: false,
        message:
          'Missing required fields: equipmentId, regNo, machine, month, year, time',
      });
    }

    const result = await equipmentServices.demobilizeEquipment({
      equipmentId,
      regNo,
      machine,
      selectedDate: selectedDate || null,
      month,
      year,
      time,
      remarks: remarks || '',
    });

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Equipment] demobilizeEquipment:', error);
    sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

/**
 * POST /add-shift
 * Add more shift on an equipment that already mobilized.
 */
const addShifts = async (req, res) => {
  try {
    const {
      equipmentId,
      regNo,
      machine,
      operators,
      month,
      year,
      time,
      selectedDate,
      remarks,
    } = req.body;

    if (!equipmentId || !regNo || !operators?.length) {
      return sendError(res, {
        status: HTTP.BAD_REQUEST,
        ok: false,
        message: 'equipmentId, regNo, operators are required',
      });
    }

    const result = await equipmentServices.addShifts({
      equipmentId,
      regNo,
      machine,
      operators,
      month,
      year,
      time,
      selectedDate,
      remarks,
    });
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Equipment] addShifts:', error);
    sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

/**
 * GET /mobilization-history/:equipmentId
 * Returns paginated mobilization history for a specific equipment unit.
 */
const getMobilizationHistory = async (req, res) => {
  try {
    const { equipmentId } = req.params;

    if (!equipmentId) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ status: HTTP.BAD_REQUEST, ok: false, message: 'Equipment ID is required' });
    }

    const result = await equipmentServices.getMobilizationHistory(
      parseInt(equipmentId),
      req.pagination
    );

    sendSuccess(res, {
      status: HTTP.OK,
      ok: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('[Equipment] getMobilizationHistory:', error);
    sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

/**
 * GET /all-mobilizations
 * Returns all mobilization records across all equipment.
 */
const getAllMobilizations = async (req, res) => {
  try {
    const result = await equipmentServices.fetchAllMobilizations();

    sendSuccess(res, { status: HTTP.OK, ok: true, data: result });
  } catch (error) {
    logger.error('[Equipment] getAllMobilizations:', error);
    sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

/**
 * GET /filtered-mobilizations
 * Returns mobilization records filtered by date range, time window, or preset period.
 */
const getFilteredMobilizations = async (req, res) => {
  try {
    const {
      filterType,
      startDate,
      endDate,
      months,
      specificTime,
      startTime,
      endTime,
    } = req.query;

    if (!filterType) {
      return sendError(res, {
        status: HTTP.BAD_REQUEST,
        ok: false,
        message:
          'filterType is required (daily, yesterday, weekly, monthly, yearly, months, custom, single)',
      });
    }

    if (filterType === 'custom' && (!startDate || !endDate)) {
      return sendError(res, {
        status: HTTP.BAD_REQUEST,
        ok: false,
        message: 'startDate and endDate are required for custom range',
      });
    }

    if (filterType === 'single' && !startDate) {
      return sendError(res, {
        status: HTTP.BAD_REQUEST,
        ok: false,
        message: 'Date is required for single date filter',
      });
    }

    if (filterType === 'months' && !months) {
      return sendError(res, {
        status: HTTP.BAD_REQUEST,
        ok: false,
        message: 'months is required for months filter type',
      });
    }

    if (startTime && endTime && startTime > endTime) {
      return sendError(res, {
        status: HTTP.BAD_REQUEST,
        ok: false,
        message: 'startTime must be before endTime',
      });
    }

    const result = await equipmentServices.fetchFilteredMobilizations(
      filterType,
      startDate,
      endDate,
      months,
      specificTime,
      startTime,
      endTime
    );

    res
      .status(HTTP.OK)
      .json({ status: HTTP.OK, ok: true, data: result, count: result.length });
  } catch (error) {
    logger.error('[Equipment] getFilteredMobilizations:', error);
    sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
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
      equipmentId,
      regNo,
      machine,
      currentOperator,
      currentOperatorId,
      replacedOperator,
      replacedOperatorId,
      targetShiftName,
      shiftName,
      shiftStart,
      shiftEnd,
      selectedDate,
      month,
      year,
      time,
      remarks,
      replaceAll,
    } = req.body;

    logger.info('mmmmmmmm', req.body);
    if (
      !equipmentId ||
      !regNo ||
      !machine ||
      !replacedOperator ||
      !replacedOperatorId ||
      !month ||
      !year ||
      !time
    ) {
      return sendError(res, {
        status: HTTP.BAD_REQUEST,
        ok: false,
        message:
          'Missing required fields: equipmentId, regNo, machine, replacedOperator, replacedOperatorId, month, year, time',
      });
    }

    if (!replaceAll && !currentOperator) {
      return sendError(res, {
        status: HTTP.BAD_REQUEST,
        ok: false,
        message: 'currentOperator is required when not replacing all operators',
      });
    }

    const result = await equipmentServices.replaceOperator({
      equipmentId,
      regNo,
      machine,
      currentOperator,
      currentOperatorId,
      replacedOperator,
      replacedOperatorId,
      targetShiftName: targetShiftName || '',
      shiftName: shiftName || '',
      shiftStart: shiftStart || '',
      shiftEnd: shiftEnd || '',
      selectedDate: selectedDate || null,
      month,
      year,
      time,
      remarks: remarks || '',
      replaceAll: replaceAll || false,
    });

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Equipment] replaceOperator:', error);
    sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

/**
 * POST /replace-equipment
 * Swaps one deployed equipment unit with another.
 */
const replaceEquipment = async (req, res) => {
  try {
    const {
      equipmentId,
      regNo,
      machine,
      replacedEquipmentId,
      replacedEquipmentRegNo,
      replacedEquipmentMachine,
      newSiteForReplaced,
      selectedDate,
      month,
      year,
      time,
      remarks,
      operator,
      operatorId,
    } = req.body;

    if (
      !equipmentId ||
      !regNo ||
      !machine ||
      !replacedEquipmentId ||
      !replacedEquipmentRegNo ||
      !replacedEquipmentMachine ||
      !month ||
      !year ||
      !time
    ) {
      return sendError(res, {
        status: HTTP.BAD_REQUEST,
        ok: false,
        message:
          'Missing required fields: equipmentId, regNo, machine, replacedEquipmentId, replacedEquipmentRegNo, replacedEquipmentMachine, month, year, time',
      });
    }

    const result = await equipmentServices.replaceEquipment({
      equipmentId,
      regNo,
      machine,
      replacedEquipmentId,
      replacedEquipmentRegNo,
      replacedEquipmentMachine,
      newSiteForReplaced: newSiteForReplaced || null,
      selectedDate: selectedDate || null,
      month,
      year,
      time,
      remarks: remarks || '',
      operator: operator || '',
      operatorId: operatorId || '',
    });

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Equipment] replaceEquipment:', error);
    sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

/**
 * GET /replacement-history/:equipmentId
 * Returns paginated replacement history for a specific equipment unit.
 */
const getReplacementHistory = async (req, res) => {
  try {
    const { equipmentId } = req.params;
    const { type } = req.query;

    if (!equipmentId) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ status: HTTP.BAD_REQUEST, ok: false, message: 'Equipment ID is required' });
    }

    const result = await equipmentServices.getReplacementHistory(
      parseInt(equipmentId),
      req.pagination,
      type
    );

    sendSuccess(res, {
      status: HTTP.OK,
      ok: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('[Equipment] getReplacementHistory:', error);
    sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

/**
 * GET /all-replacements
 * Returns all replacement records across all equipment.
 */
const getAllReplacements = async (req, res) => {
  try {
    const result = await equipmentServices.fetchAllReplacements();

    sendSuccess(res, { status: HTTP.OK, ok: true, data: result });
  } catch (error) {
    logger.error('[Equipment] getAllReplacements:', error);
    sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
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
      return sendError(res, {
        status: HTTP.BAD_REQUEST,
        ok: false,
        message:
          'filterType is required (daily, yesterday, weekly, monthly, yearly, months, custom)',
      });
    }

    if (filterType === 'custom' && (!startDate || !endDate)) {
      return sendError(res, {
        status: HTTP.BAD_REQUEST,
        ok: false,
        message: 'startDate and endDate are required for custom range',
      });
    }

    if (filterType === 'months' && !months) {
      return sendError(res, {
        status: HTTP.BAD_REQUEST,
        ok: false,
        message: 'months is required for months filter type',
      });
    }

    const result = await equipmentServices.fetchFilteredReplacements(
      filterType,
      startDate,
      endDate,
      months
    );

    res
      .status(HTTP.OK)
      .json({ status: HTTP.OK, ok: true, data: result, count: result.length });
  } catch (error) {
    logger.error('[Equipment] getFilteredReplacements:', error);
    sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
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
  addShifts,
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
