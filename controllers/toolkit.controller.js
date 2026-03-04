// controllers/toolkit.controller.js
const toolkitServices = require('../services/toolkit.service.js');

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

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Toolkit] addToolKits:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * GET /toolkit
 * Returns all toolkit records.
 */
const getToolKits = async (req, res) => {
  try {
    const result = await toolkitServices.fetchToolkits();

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Toolkit] getToolKits:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /toolkit/:id
 * Updates a toolkit record by ID.
 */
const updatetoolKits = async (req, res) => {
  try {
    const { id }     = req.params;
    const updateData = req.body;

    if (!id) {
      return res.status(400).json({ success: false, message: 'Toolkit ID is required' });
    }

    const result = await toolkitServices.updateToolkit(id, updateData);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Toolkit] updatetoolKits:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
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
      return res.status(400).json({ success: false, message: 'Toolkit ID is required' });
    }

    const result = await toolkitServices.deleteToolkit(id);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Toolkit] deletetoolKits:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
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
      return res.status(400).json({ success: false, message: 'Search query is required' });
    }

    const result = await toolkitServices.searchToolkits(q);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Toolkit] searchToolkits:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
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
    const updateData               = req.body;

    if (!toolkitId || !variantId) {
      return res.status(400).json({ success: false, message: 'toolkitId and variantId are required' });
    }

    const result = await toolkitServices.updateVariant(toolkitId, variantId, updateData);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Toolkit] updateVariant:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
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
      return res.status(400).json({ success: false, message: 'toolkitId and variantId are required' });
    }

    const result = await toolkitServices.deleteVariant(toolkitId, variantId);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Toolkit] deleteVariant:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
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
    const { toolkitId, variantId }                                   = req.params;
    const { quantity, reason, updatedBy, person, personId, assignedDate } = req.body;

    if (!toolkitId || !variantId) {
      return res.status(400).json({ success: false, message: 'toolkitId and variantId are required' });
    }

    if (!quantity || quantity <= 0) {
      return res.status(400).json({ success: false, message: 'Valid quantity is required' });
    }

    const result = await toolkitServices.reduceStock(
      toolkitId, variantId, quantity, reason, updatedBy, person, personId, assignedDate
    );

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Toolkit] reduceStock:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
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
      return res.status(400).json({ success: false, message: 'toolkitId and variantId are required' });
    }

    const result = await toolkitServices.getStockHistory(toolkitId, variantId);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Toolkit] getStockHistory:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
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
      return res.status(400).json({ success: false, message: 'Toolkit ID is required' });
    }

    const result = await toolkitServices.getToolkitStockHistory(toolkitId);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Toolkit] getToolkitStockHistory:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
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
      return res.status(400).json({ success: false, message: 'Barcode data is required' });
    }

    const result = await toolkitServices.scanToolkitByBarcode(objectId);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Toolkit] scanToolkitByBarcode:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
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