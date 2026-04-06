// ─────────────────────────────────────────────────────────────────────────────
// Toolkit Service
// Flat named async functions — no prototype objects, no class syntax.
// Follows the same conventions as equipment.service.js.
// ─────────────────────────────────────────────────────────────────────────────

const Toolkit  = require('../models/toolkit.model');
const Mechanic = require('../models/mechanic.model');
const Operator = require('../models/operator.model');
const User     = require('../models/user.model');
const mongoose = require('mongoose');

const { createNotification }  = require('./notification.service');
const PushNotificationService = require('../push/notification.push');
const { default: wsUtils } = require('../sockets/websocket.js');
const analyser = require('../analyser/dashboard.analyser');

// ─────────────────────────────────────────────────────────────────────────────
// Internal: Stock history helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Appends a stock history entry to a variant in-place.
 * @param {object} variant
 * @param {string} action
 * @param {number} previousStock
 * @param {number} newStock
 * @param {string} [reason]
 * @param {string} [updatedBy]
 * @param {string} [person]
 * @param {string} [personId]
 * @param {Date}   [assignedDate]
 */
const _addStockHistoryEntry = (variant, action, previousStock, newStock, reason = '', updatedBy = 'System', person, personId, assignedDate) => {
  const validPreviousStock = Number(previousStock) || 0;
  const validNewStock      = Number(newStock)      || 0;

  variant.stockHistory.push({
    action,
    previousStock: validPreviousStock,
    newStock:      validNewStock,
    changeAmount:  validNewStock - validPreviousStock,
    reason,
    size:          variant.size,
    color:         variant.color,
    timestamp:     new Date(),
    updatedBy,
    person,
    personId,
    assignedDate
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Internal: Notification helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fire-and-forget: creates an in-app notification + push notification.
 * Errors are logged but never surfaced to callers.
 * @param {string}      title
 * @param {string}      description
 * @param {string}      [priority='low']
 * @param {string|null} [sourceId]
 * @param {string|null} [recipient]
 */
const _sendNotification = async (title, description, priority = 'low', sourceId = null, recipient = null) => {
  try {
    const notification = await createNotification({
      title,
      description,
      priority,
      sourceId,
      time: new Date()
    });

    await PushNotificationService.sendGeneralNotification(
      recipient,
      title,
      description,
      priority,
      'normal',
      notification.data._id.toString()
    );
  } catch (err) {
    console.error('[ToolkitService] Notification failed:', err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Insert / Add
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inserts a new toolkit or adds/updates a variant on an existing toolkit.
 * @param {object} toolkitData
 * @returns {Promise<object>}
 */
const insertToolkit = async (toolkitData) => {
  try {
    const { name, type, size, color, stockCount, minStockLevel, reason, updatedBy } = toolkitData;

    const existingToolkit = await Toolkit.findOne({
      name: { $regex: new RegExp(`^${name.trim().toLowerCase()}$`, 'i') }
    });

    if (existingToolkit) {
      const existingVariant = existingToolkit.variants.find(
        v => v.size?.toLowerCase()  === size?.toLowerCase() &&
             v.color?.toLowerCase() === color?.toLowerCase()
      );

      if (existingVariant) {
        // Update existing variant stock
        const previousStock = existingVariant.stockCount;
        existingVariant.stockCount   += stockCount;
        existingVariant.minStockLevel = minStockLevel || existingVariant.minStockLevel;

        _addStockHistoryEntry(
          existingVariant,
          'updated',
          previousStock,
          existingVariant.stockCount,
          reason || `Stock updated: Added ${stockCount} items`,
          updatedBy || 'System'
        );
      } else {
        // Add new variant to existing toolkit
        const newVariant = {
          size:            size  || 'N/A',
          color:           color || 'N/A',
          stockCount,
          minStockLevel:   minStockLevel || 5,
          inuse:           false,
          firstAddedDate:  new Date(),
          lastUpdatedDate: new Date(),
          stockHistory:    []
        };

        _addStockHistoryEntry(
          newVariant,
          'initial',
          0,
          stockCount,
          reason || `New variant added: ${size} - ${color}`,
          updatedBy || 'System'
        );

        existingToolkit.variants.push(newVariant);
      }

      const savedToolkit = await existingToolkit.save();

      await _sendNotification(
        'New Safety Items Added',
        `New ${stockCount} ${name} added to stock`,
        'low',
        savedToolkit._id
      );

      analyser.clearCache();
      wsUtils.sendDashboardUpdate('toolkit');

      return {
        status:  200,
        ok:      true,
        message: existingVariant ? 'Variant stock updated successfully' : 'New variant added successfully',
        data:    savedToolkit
      };
    }

    // Create brand-new toolkit with first variant
    const newVariant = {
      size:            size  || 'N/A',
      color:           color || 'N/A',
      stockCount,
      minStockLevel:   minStockLevel || 5,
      inuse:           false,
      firstAddedDate:  new Date(),
      lastUpdatedDate: new Date(),
      stockHistory:    []
    };

    _addStockHistoryEntry(
      newVariant,
      'initial',
      0,
      stockCount,
      reason || `Initial stock for new toolkit: ${name}`,
      updatedBy || 'System'
    );

    const savedToolkit = await new Toolkit({ name: name.trim(), type, variants: [newVariant] }).save();

    return { status: 201, ok: true, message: 'Toolkit added successfully', data: savedToolkit };

  } catch (err) {
    console.error('[ToolkitService] insertToolkit:', err);
    return { status: 500, ok: false, message: 'Failed to add toolkit', error: err.message };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Fetch / Search
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns all toolkits sorted by newest first.
 * @returns {Promise<object>}
 */
const fetchToolkits = async () => {
  try {
    const toolkits = await Toolkit.find({}).sort({ createdAt: -1 });
    return { status: 200, ok: true, message: 'Toolkits fetched successfully', data: toolkits };
  } catch (err) {
    console.error('[ToolkitService] fetchToolkits:', err);
    return { status: 500, ok: false, message: 'Failed to fetch toolkits', error: err.message };
  }
};

/**
 * Full-text search across toolkit names.
 * @param {string} searchTerm
 * @returns {Promise<object>}
 */
const searchToolkits = async (searchTerm) => {
  try {
    const toolkits = await Toolkit.find({
      name: { $regex: new RegExp(searchTerm, 'i') }
    }).sort({ createdAt: -1 });

    return { status: 200, ok: true, message: 'Search completed successfully', data: toolkits };
  } catch (err) {
    console.error('[ToolkitService] searchToolkits:', err);
    return { status: 500, ok: false, message: 'Failed to search toolkits', error: err.message };
  }
};

/**
 * Looks up a toolkit by its ObjectId (barcode scan).
 * Handles BOTH toolkit-level barcodes AND variant-level barcodes.
 * When a variant _id is scanned, finds the parent toolkit and marks
 * which variant was scanned via `scannedVariantId`.
 *
 * @param {string} objectId
 * @returns {Promise<object>}
 */
const scanToolkitByBarcode = async (objectId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(objectId)) {
      return {
        status:  400,
        ok:      false,
        success: false,
        message: 'Invalid barcode format. Please scan a valid toolkit barcode.',
      };
    }
 
    // ── 1. Try direct toolkit match ───────────────────────────────────────
    let toolkit        = await Toolkit.findById(objectId);
    let scannedVariantId = null;
 
    // ── 2. If not found, search variants whose _id matches ────────────────
    if (!toolkit) {
      toolkit = await Toolkit.findOne({
        'variants._id': new mongoose.Types.ObjectId(objectId),
      });
 
      if (toolkit) {
        scannedVariantId = objectId;
      }
    }
 
    if (!toolkit) {
      return {
        status:  404,
        ok:      false,
        success: false,
        message: 'Toolkit not found. This item may have been deleted or does not exist.',
      };
    }
 
    const result = toolkit.toObject();
 
    // ── Sort variants: scanned variant first, then by stock status ─────────
    result.variants.sort((a, b) => {
      // Scanned variant always comes first
      const aIsScanned = a._id.toString() === scannedVariantId;
      const bIsScanned = b._id.toString() === scannedVariantId;
      if (aIsScanned) return -1;
      if (bIsScanned) return  1;
 
      // Then sort by availability
      const order = { available: 0, low: 1, out: 2 };
      return (order[a.status] ?? 3) - (order[b.status] ?? 3);
    });
 
    // ── Sort each variant's history newest-first ───────────────────────────
    result.variants.forEach(v => {
      if (v.stockHistory?.length) {
        v.stockHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      }
    });
 
    const totalVariants      = result.variants.length;
    const inStockVariants    = result.variants.filter(v => v.status === 'available').length;
    const lowStockVariants   = result.variants.filter(v => v.status === 'low').length;
    const outOfStockVariants = result.variants.filter(v => v.status === 'out').length;
 
    return {
      status:  200,
      ok:      true,
      success: true,
      message: scannedVariantId
        ? 'Variant scanned successfully'
        : 'Toolkit scanned successfully',
      data: {
        ...result,
        // Tell the mobile scanner exactly which variant was scanned
        scannedVariantId: scannedVariantId || null,
        metrics: {
          totalVariants,
          inStockVariants,
          lowStockVariants,
          outOfStockVariants,
          totalStock:    toolkit.totalStock,
          overallStatus: toolkit.overallStatus,
        },
      },
    };
  } catch (err) {
    console.error('[ToolkitService] scanToolkitByBarcode:', err);
    return {
      status:  500,
      ok:      false,
      success: false,
      message: 'Error scanning toolkit barcode',
      error:   err.message,
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Updates toolkit-level fields and recalculates totalStock / overallStatus.
 * @param {string} toolkitId
 * @param {object} updateData
 * @returns {Promise<object>}
 */
const updateToolkit = async (toolkitId, updateData) => {
  try {
    const currentToolkit = await Toolkit.findById(toolkitId);
    if (!currentToolkit) {
      return { status: 404, ok: false, message: `Toolkit with ID ${toolkitId} not found` };
    }

    const variants    = updateData.variants || currentToolkit.variants;
    const totalStock  = variants.reduce((sum, v) => sum + (v.stockCount || 0), 0);
    const hasAvailable = variants.some(v => v.stockCount > 0 && v.status === 'available');
    const overallStatus = totalStock > 0 ? (hasAvailable ? 'available' : 'low') : 'out';

    const updatedToolkit = await Toolkit.findByIdAndUpdate(
      toolkitId,
      { ...updateData, totalStock, overallStatus, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    return { status: 200, ok: true, message: 'Toolkit updated successfully', data: updatedToolkit };
  } catch (err) {
    console.error('[ToolkitService] updateToolkit:', err);
    return { status: 500, ok: false, message: 'Failed to update toolkit', error: err.message };
  }
};

/**
 * Updates a specific variant within a toolkit, tracking any stock changes.
 * @param {string} toolkitId
 * @param {string} variantId
 * @param {object} updateData
 * @returns {Promise<object>}
 */
const updateVariant = async (toolkitId, variantId, updateData) => {
  try {
    const toolkit = await Toolkit.findById(toolkitId);
    if (!toolkit) return { status: 404, ok: false, message: `Toolkit with ID ${toolkitId} not found` };

    const variant = toolkit.variants.id(variantId);
    if (!variant) return { status: 404, ok: false, message: `Variant with ID ${variantId} not found` };

    let action;
    let previousStock;

    if (updateData.stockCount !== undefined && updateData.stockCount !== variant.stockCount) {
      previousStock   = variant.stockCount;
      const newStock  = updateData.stockCount;
      action          = newStock > previousStock ? 'added' : 'reduced';

      _addStockHistoryEntry(
        variant,
        action,
        previousStock,
        newStock,
        updateData.reason || `Stock ${action}: ${Math.abs(newStock - previousStock)} items`,
        updateData.updatedBy || 'System'
      );
    }

    Object.keys(updateData).forEach(key => {
      if (key in variant && key !== 'reason' && key !== 'updatedBy') {
        variant[key] = updateData[key];
      }
    });

    const savedToolkit = await toolkit.save();

    const changeAmount = Math.abs((updateData.stockCount ?? previousStock) - (previousStock ?? 0));
    await _sendNotification(
      'Safety Items Update',
      `${changeAmount} items ${action} in Size:${variant.size} - Color:${variant.color} - ${toolkit.name}`,
      'low',
      toolkit._id
    );

    return { status: 200, ok: true, message: 'Variant updated successfully', data: savedToolkit };
  } catch (err) {
    console.error('[ToolkitService] updateVariant:', err);
    return { status: 500, ok: false, message: 'Failed to update variant', error: err.message };
  }
};

/**
 * Reduces variant stock by a given quantity and assigns items to a person.
 * @param {string} toolkitId
 * @param {string} variantId
 * @param {number} quantity
 * @param {string} [reason]
 * @param {string} [updatedBy]
 * @param {string} [person]
 * @param {string} [personId]
 * @param {Date}   [assignedDate]
 * @returns {Promise<object>}
 */
const reduceStock = async (toolkitId, variantId, quantity, reason = '', updatedBy = 'System', person, personId, assignedDate) => {
  try {
    const toolkit = await Toolkit.findById(toolkitId);
    if (!toolkit) return { status: 404, ok: false, message: `Toolkit with ID ${toolkitId} not found` };

    const variant = toolkit.variants.id(variantId);
    if (!variant) return { status: 404, ok: false, message: `Variant with ID ${variantId} not found` };

    if (variant.stockCount < quantity) {
      return { status: 400, ok: false, message: `Insufficient stock. Available: ${variant.stockCount}, Requested: ${quantity}` };
    }

    const previousStock   = variant.stockCount;
    variant.stockCount   -= quantity;

    _addStockHistoryEntry(
      variant,
      'reduced',
      previousStock,
      variant.stockCount,
      reason || `Stock reduced: ${quantity} items used`,
      updatedBy,
      person,
      personId,
      assignedDate
    );

    // Resolve the assigned person across all person collections
    const [officeUser, operator, mechanic] = await Promise.all([
      User.findById(personId).catch(() => null),
      Operator.findById(personId).catch(() => null),
      Mechanic.findById(personId).catch(() => null)
    ]);

    const assignedPerson = officeUser || operator || mechanic;

    if (assignedPerson) {
      if (!assignedPerson.toolkits) assignedPerson.toolkits = [];

      assignedPerson.toolkits.push({
        toolkitId:    toolkit._id,
        toolkitName:  toolkit.name,
        type:         toolkit.type,
        variantId:    variant._id,
        size:         variant.size,
        color:        variant.color,
        quantity,
        assignedDate,
        assignedBy:   updatedBy,
        reason:       reason || `Stock reduced: ${quantity} items used`,
        status:       'assigned'
      });

      await assignedPerson.save();
    }

    const savedToolkit = await toolkit.save();

    await _sendNotification(
      'Safety Items Update',
      `${quantity} ${variant.color} color ${variant.size} size ${toolkit.name} handovered to ${person}`,
      'low',
      toolkit._id
    );

    return { status: 200, ok: true, message: 'Stock reduced successfully', data: savedToolkit };
  } catch (err) {
    console.error('[ToolkitService] reduceStock:', err);
    return { status: 500, ok: false, message: 'Failed to reduce stock', error: err.message };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deletes an entire toolkit by ID.
 * @param {string} toolkitId
 * @returns {Promise<object>}
 */
const deleteToolkit = async (toolkitId) => {
  try {
    const deleted = await Toolkit.findByIdAndDelete(toolkitId);
    if (!deleted) return { status: 404, ok: false, message: `Toolkit with ID ${toolkitId} not found` };

    return { status: 200, ok: true, message: 'Toolkit deleted successfully', data: deleted };
  } catch (err) {
    console.error('[ToolkitService] deleteToolkit:', err);
    return { status: 500, ok: false, message: 'Failed to delete toolkit', error: err.message };
  }
};

/**
 * Deletes a specific variant from a toolkit.
 * Deletes the entire toolkit if no variants remain.
 * @param {string} toolkitId
 * @param {string} variantId
 * @returns {Promise<object>}
 */
const deleteVariant = async (toolkitId, variantId) => {
  try {
    const toolkit = await Toolkit.findById(toolkitId);
    if (!toolkit) return { status: 404, ok: false, message: `Toolkit with ID ${toolkitId} not found` };

    const variant = toolkit.variants.id(variantId);
    if (!variant) return { status: 404, ok: false, message: `Variant with ID ${variantId} not found` };

    toolkit.variants.pull(variantId);

    if (toolkit.variants.length === 0) {
      await Toolkit.findByIdAndDelete(toolkitId);
      return { status: 200, ok: true, message: 'Toolkit deleted as no variants remain', data: null };
    }

    const savedToolkit = await toolkit.save();
    return { status: 200, ok: true, message: 'Variant deleted successfully', data: savedToolkit };
  } catch (err) {
    console.error('[ToolkitService] deleteVariant:', err);
    return { status: 500, ok: false, message: 'Failed to delete variant', error: err.message };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Stock History
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns stock history for a specific variant.
 * @param {string} toolkitId
 * @param {string} variantId
 * @returns {Promise<object>}
 */
const getStockHistory = async (toolkitId, variantId) => {
  try {
    const toolkit = await Toolkit.findById(toolkitId);
    if (!toolkit) return { status: 404, ok: false, message: `Toolkit with ID ${toolkitId} not found` };

    const variant = toolkit.variants.id(variantId);
    if (!variant) return { status: 404, ok: false, message: `Variant with ID ${variantId} not found` };

    return {
      status: 200,
      ok:     true,
      message: 'Stock history retrieved successfully',
      data: {
        toolkit: { name: toolkit.name, type: toolkit.type },
        variant: { size: variant.size, color: variant.color, currentStock: variant.stockCount, firstAddedDate: variant.firstAddedDate, lastUpdatedDate: variant.lastUpdatedDate },
        stockHistory: [...variant.stockHistory].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      }
    };
  } catch (err) {
    console.error('[ToolkitService] getStockHistory:', err);
    return { status: 500, ok: false, message: 'Failed to get stock history', error: err.message };
  }
};

/**
 * Returns stock history for all variants of a toolkit.
 * @param {string} toolkitId
 * @returns {Promise<object>}
 */
const getToolkitStockHistory = async (toolkitId) => {
  try {
    const toolkit = await Toolkit.findById(toolkitId);
    if (!toolkit) return { status: 404, ok: false, message: `Toolkit with ID ${toolkitId} not found` };

    return {
      status: 200,
      ok:     true,
      message: 'Toolkit stock history retrieved successfully',
      data: {
        toolkit: { name: toolkit.name, type: toolkit.type, createdAt: toolkit.createdAt },
        variants: toolkit.variants.map(v => ({
          _id:             v._id,
          size:            v.size,
          color:           v.color,
          currentStock:    v.stockCount,
          firstAddedDate:  v.firstAddedDate,
          lastUpdatedDate: v.lastUpdatedDate,
          stockHistory:    [...v.stockHistory].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        }))
      }
    };
  } catch (err) {
    console.error('[ToolkitService] getToolkitStockHistory:', err);
    return { status: 500, ok: false, message: 'Failed to get toolkit stock history', error: err.message };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Insert / Add
  insertToolkit,
  // Fetch / Search
  fetchToolkits,
  searchToolkits,
  scanToolkitByBarcode,
  // Update
  updateToolkit,
  updateVariant,
  reduceStock,
  // Delete
  deleteToolkit,
  deleteVariant,
  // Stock History
  getStockHistory,
  getToolkitStockHistory
};