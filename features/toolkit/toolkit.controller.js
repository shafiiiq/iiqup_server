const logger = require('../../shared/logger/logger');

const HTTP = require('../../shared/constants/httpStatus.constant.js');
const { sendSuccess, sendError } = require('../../shared/response/response.util');
// controllers/toolkit.controller.js
const toolkitServices = require('./toolkit.service');

// ─────────────────────────────────────────────────────────────────────────────
// Toolkit CRUD Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /toolkit
 * Adds a new toolkit record.
 */
const addToolKits = async (req, res) => {
  try {
    const result = await toolkitServices.insertToolkit(req.body);

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Toolkit] addToolKits:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

/**
 * GET /toolkit
 * Returns all toolkit records.
 */
const getToolKits = async (req, res) => {
  try {
    const result = await toolkitServices.fetchToolkits(req.pagination);

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Toolkit] getToolKits:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

/**
 * PUT /toolkit/:id
 * Updates a toolkit record by ID.
 */
const updatetoolKits = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!id) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'Toolkit ID is required' });
    }

    const result = await toolkitServices.updateToolkit(id, updateData);

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Toolkit] updatetoolKits:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

/**
 * DELETE /toolkit/:id
 * Deletes a toolkit record by ID.
 */
const deletetoolKits = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'Toolkit ID is required' });
    }

    const result = await toolkitServices.deleteToolkit(id);

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Toolkit] deletetoolKits:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

/**
 * GET /toolkit/search
 * Returns toolkits matching a search query. Query param: q.
 */
const searchToolkits = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'Search query is required' });
    }

    const result = await toolkitServices.searchToolkits(q, req.pagination);

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Toolkit] searchToolkits:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Variant Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PUT /toolkit/:toolkitId/variant/:variantId
 * Updates a specific variant within a toolkit.
 */
const updateVariant = async (req, res) => {
  try {
    const { toolkitId, variantId } = req.params;
    const updateData = req.body;

    if (!toolkitId || !variantId) {
      return sendError(res, {
        success: false,
        message: 'toolkitId and variantId are required',
      });
    }

    const result = await toolkitServices.updateVariant(
      toolkitId,
      variantId,
      updateData
    );

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Toolkit] updateVariant:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

/**
 * DELETE /toolkit/:toolkitId/variant/:variantId
 * Deletes a specific variant from a toolkit.
 */
const deleteVariant = async (req, res) => {
  try {
    const { toolkitId, variantId } = req.params;

    if (!toolkitId || !variantId) {
      return sendError(res, {
        success: false,
        message: 'toolkitId and variantId are required',
      });
    }

    const result = await toolkitServices.deleteVariant(toolkitId, variantId);

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Toolkit] deleteVariant:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Stock Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PUT /toolkit/:toolkitId/variant/:variantId/reduce
 * Reduces stock for a specific toolkit variant.
 */
const reduceStock = async (req, res) => {
  try {
    const { toolkitId, variantId } = req.params;
    const { quantity, reason, updatedBy, person, personId, assignedDate } =
      req.body;

    if (!toolkitId || !variantId) {
      return sendError(res, {
        success: false,
        message: 'toolkitId and variantId are required',
      });
    }

    if (!quantity || quantity <= 0) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'Valid quantity is required' });
    }

    const result = await toolkitServices.reduceStock(
      toolkitId,
      variantId,
      quantity,
      reason,
      updatedBy,
      person,
      personId,
      assignedDate
    );

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Toolkit] reduceStock:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

/**
 * GET /toolkit/:toolkitId/variant/:variantId/history
 * Returns stock movement history for a specific toolkit variant.
 */
const getStockHistory = async (req, res) => {
  try {
    const { toolkitId, variantId } = req.params;

    if (!toolkitId || !variantId) {
      return sendError(res, {
        success: false,
        message: 'toolkitId and variantId are required',
      });
    }

    const result = await toolkitServices.getStockHistory(toolkitId, variantId);

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Toolkit] getStockHistory:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

/**
 * GET /toolkit/:toolkitId/history
 * Returns full stock movement history for a toolkit across all variants.
 */
const getToolkitStockHistory = async (req, res) => {
  try {
    const { toolkitId } = req.params;

    if (!toolkitId) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'Toolkit ID is required' });
    }

    const result = await toolkitServices.getToolkitStockHistory(toolkitId);

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Toolkit] getToolkitStockHistory:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

/**
 * GET /toolkit/barcode/:objectId
 * Looks up a toolkit record by barcode object ID.
 */
const scanToolkitByBarcode = async (req, res) => {
  try {
    const { objectId } = req.params;

    if (!objectId) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'Barcode data is required' });
    }

    const result = await toolkitServices.scanToolkitByBarcode(objectId);

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Toolkit] scanToolkitByBarcode:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // CRUD
  addToolKits,
  getToolKits,
  updatetoolKits,
  deletetoolKits,
  searchToolkits,
  // Variants
  updateVariant,
  deleteVariant,
  // Stock
  reduceStock,
  getStockHistory,
  getToolkitStockHistory,
  scanToolkitByBarcode,
};
