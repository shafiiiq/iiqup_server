// file 2
const logger = require('#shared/logger/logger');

const HTTP = require('#shared/response/response.status')

const Toolkit = require('./toolkit.model');
const Mechanic = require('#features/user/mechanic/mechanic.model');
const Operator = require('#features/user/operator/operator.model');
const User = require('#features/user/staff/staff.model');
const mongoose = require('mongoose');
const { paginate } = require('#shared/pagination/pagination')

const wsUtils = require('#core/socket/socket.io');
const dashboardServices = require('#features/dashboard/dashboard.service')

const _addStockHistoryEntry = (
  variant,
  action,
  previousStock,
  newStock,
  reason = '',
  updatedBy = 'System',
  person,
  personId,
  assignedDate
) => {
  const validPreviousStock = Number(previousStock) || 0;
  const validNewStock = Number(newStock) || 0;

  variant.stockHistory.push({
    action,
    previousStock: validPreviousStock,
    newStock: validNewStock,
    changeAmount: validNewStock - validPreviousStock,
    reason,
    size: variant.size,
    color: variant.color,
    timestamp: new Date(),
    updatedBy,
    person,
    personId,
    assignedDate,
  });
};

const insertToolkit = async (toolkitData) => {
  try {
    const {
      name,
      type,
      size,
      color,
      stockCount,
      minStockLevel,
      reason,
      updatedBy,
    } = toolkitData;

    const existingToolkit = await Toolkit.findOne({
      name: { $regex: new RegExp(`^${name.trim().toLowerCase()}$`, 'i') },
    });

    if (existingToolkit) {
      const existingVariant = existingToolkit.variants.find(
        (v) =>
          v.size?.toLowerCase() === size?.toLowerCase() &&
          v.color?.toLowerCase() === color?.toLowerCase()
      );

      if (existingVariant) {
        // Update existing variant stock
        const previousStock = existingVariant.stockCount;
        existingVariant.stockCount += stockCount;
        existingVariant.minStockLevel =
          minStockLevel || existingVariant.minStockLevel;

        _addStockHistoryEntry(
          existingVariant,
          'updated',
          previousStock,
          existingVariant.stockCount,
          reason || `Stock updated: Added ${stockCount} items`,
          updatedBy || 'System'
        );
      } else {
        const newVariant = {
          size: size || 'N/A',
          color: color || 'N/A',
          stockCount,
          minStockLevel: minStockLevel || 5,
          inuse: false,
          firstAddedDate: new Date(),
          lastUpdatedDate: new Date(),
          stockHistory: [],
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

      dashboardServices.clearDashboardCache()
      wsUtils.dispatchDashboardUpdate('toolkit');

      return {
        status: HTTP.OK,
        ok: true,
        message: existingVariant
          ? 'Variant stock updated successfully'
          : 'New variant added successfully',
        data: savedToolkit,
      };
    }

    const newVariant = {
      size: size || 'N/A',
      color: color || 'N/A',
      stockCount,
      minStockLevel: minStockLevel || 5,
      inuse: false,
      firstAddedDate: new Date(),
      lastUpdatedDate: new Date(),
      stockHistory: [],
    };

    _addStockHistoryEntry(
      newVariant,
      'initial',
      0,
      stockCount,
      reason || `Initial stock for new toolkit: ${name}`,
      updatedBy || 'System'
    );

    const savedToolkit = await new Toolkit({
      name: name.trim(),
      type,
      variants: [newVariant],
    }).save();

    return {
      status: HTTP.CREATED,
      ok: true,
      message: 'Toolkit added successfully',
      data: savedToolkit,
    };
  } catch (err) {
    logger.error('[ToolkitService] insertToolkit:', err);
    return {
      status: HTTP.INTERNAL_SERVER_ERROR,
      ok: false,
      message: 'Failed to add toolkit',
      error: err.message,
    };
  }
};

const fetchToolkits = async (pagination) => {
  try {
    const result = await paginate(Toolkit, {}, pagination, {
      sort: { createdAt: -1 },
    });
    return {
      status: HTTP.OK,
      ok: true,
      message: 'Toolkits fetched successfully',
      data: result.data,
      pagination: result.pagination,
    };
  } catch (err) {
    logger.error('[ToolkitService] fetchToolkits:', err);
    return {
      status: HTTP.INTERNAL_SERVER_ERROR,
      ok: false,
      message: 'Failed to fetch toolkits',
      error: err.message,
    };
  }
};

const searchToolkits = async (searchTerm, pagination) => {
  try {
    const result = await paginate(
      Toolkit,
      {
        name: { $regex: new RegExp(searchTerm, 'i') },
      },
      pagination,
      {
        sort: { createdAt: -1 },
      }
    );

    return {
      status: HTTP.OK,
      ok: true,
      message: 'Search completed successfully',
      data: result.data,
      pagination: result.pagination,
    };
  } catch (err) {
    logger.error('[ToolkitService] searchToolkits:', err);
    return {
      status: HTTP.INTERNAL_SERVER_ERROR,
      ok: false,
      message: 'Failed to search toolkits',
      error: err.message,
    };
  }
};

const scanToolkitByBarcode = async (objectId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(objectId)) {
      return {
        status: HTTP.BAD_REQUEST,
        ok: false,
        success: false,
        message: 'Invalid barcode format. Please scan a valid toolkit barcode.',
      };
    }

    let toolkit = await Toolkit.findById(objectId);
    let scannedVariantId = null;

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
        status: HTTP.NOT_FOUND,
        ok: false,
        success: false,
        message:
          'Toolkit not found. This item may have been deleted or does not exist.',
      };
    }

    const result = toolkit.toObject();

    result.variants.sort((a, b) => {
      const aIsScanned = a._id.toString() === scannedVariantId;
      const bIsScanned = b._id.toString() === scannedVariantId;
      if (aIsScanned) return -1;
      if (bIsScanned) return 1;

      const order = { available: 0, low: 1, out: 2 };
      return (order[a.status] ?? 3) - (order[b.status] ?? 3);
    });

    result.variants.forEach((v) => {
      if (v.stockHistory?.length) {
        v.stockHistory.sort(
          (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
        );
      }
    });

    const totalVariants = result.variants.length;
    const inStockVariants = result.variants.filter(
      (v) => v.status === 'available'
    ).length;
    const lowStockVariants = result.variants.filter(
      (v) => v.status === 'low'
    ).length;
    const outOfStockVariants = result.variants.filter(
      (v) => v.status === 'out'
    ).length;

    return {
      status: HTTP.OK,
      ok: true,
      success: true,
      message: scannedVariantId
        ? 'Variant scanned successfully'
        : 'Toolkit scanned successfully',
      data: {
        ...result,
        scannedVariantId: scannedVariantId || null,
        metrics: {
          totalVariants,
          inStockVariants,
          lowStockVariants,
          outOfStockVariants,
          totalStock: toolkit.totalStock,
          overallStatus: toolkit.overallStatus,
        },
      },
    };
  } catch (err) {
    logger.error('[ToolkitService] scanToolkitByBarcode:', err);
    return {
      status: HTTP.INTERNAL_SERVER_ERROR,
      ok: false,
      success: false,
      message: 'Error scanning toolkit barcode',
      error: err.message,
    };
  }
};

const updateToolkit = async (toolkitId, updateData) => {
  try {
    const currentToolkit = await Toolkit.findById(toolkitId);
    if (!currentToolkit) {
      return {
        status: HTTP.NOT_FOUND,
        ok: false,
        message: `Toolkit with ID ${toolkitId} not found`,
      };
    }

    const variants = updateData.variants || currentToolkit.variants;
    const totalStock = variants.reduce(
      (sum, v) => sum + (v.stockCount || 0),
      0
    );
    const hasAvailable = variants.some(
      (v) => v.stockCount > 0 && v.status === 'available'
    );
    const overallStatus =
      totalStock > 0 ? (hasAvailable ? 'available' : 'low') : 'out';

    const updatedToolkit = await Toolkit.findByIdAndUpdate(
      toolkitId,
      { ...updateData, totalStock, overallStatus, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    return {
      status: HTTP.OK,
      ok: true,
      message: 'Toolkit updated successfully',
      data: updatedToolkit,
    };
  } catch (err) {
    logger.error('[ToolkitService] updateToolkit:', err);
    return {
      status: HTTP.INTERNAL_SERVER_ERROR,
      ok: false,
      message: 'Failed to update toolkit',
      error: err.message,
    };
  }
};

const updateVariant = async (toolkitId, variantId, updateData) => {
  try {
    const toolkit = await Toolkit.findById(toolkitId);
    if (!toolkit)
      return {
        status: HTTP.NOT_FOUND,
        ok: false,
        message: `Toolkit with ID ${toolkitId} not found`,
      };

    const variant = toolkit.variants.id(variantId);
    if (!variant)
      return {
        status: HTTP.NOT_FOUND,
        ok: false,
        message: `Variant with ID ${variantId} not found`,
      };

    let action;
    let previousStock;

    if (
      updateData.stockCount !== undefined &&
      updateData.stockCount !== variant.stockCount
    ) {
      previousStock = variant.stockCount;
      const newStock = updateData.stockCount;
      action = newStock > previousStock ? 'added' : 'reduced';

      _addStockHistoryEntry(
        variant,
        action,
        previousStock,
        newStock,
        updateData.reason ||
          `Stock ${action}: ${Math.abs(newStock - previousStock)} items`,
        updateData.updatedBy || 'System'
      );
    }

    Object.keys(updateData).forEach((key) => {
      if (key in variant && key !== 'reason' && key !== 'updatedBy') {
        variant[key] = updateData[key];
      }
    });

    const savedToolkit = await toolkit.save();

    return {
      status: HTTP.OK,
      ok: true,
      message: 'Variant updated successfully',
      data: savedToolkit,
    };
  } catch (err) {
    logger.error('[ToolkitService] updateVariant:', err);
    return {
      status: HTTP.INTERNAL_SERVER_ERROR,
      ok: false,
      message: 'Failed to update variant',
      error: err.message,
    };
  }
};

const reduceStock = async (
  toolkitId,
  variantId,
  quantity,
  reason = '',
  updatedBy = 'System',
  person,
  personId,
  assignedDate
) => {
  try {
    const toolkit = await Toolkit.findById(toolkitId);
    if (!toolkit)
      return {
        status: HTTP.NOT_FOUND,
        ok: false,
        message: `Toolkit with ID ${toolkitId} not found`,
      };

    const variant = toolkit.variants.id(variantId);
    if (!variant)
      return {
        status: HTTP.NOT_FOUND,
        ok: false,
        message: `Variant with ID ${variantId} not found`,
      };

    if (variant.stockCount < quantity) {
      return {
        status: HTTP.BAD_REQUEST,
        ok: false,
        message: `Insufficient stock. Available: ${variant.stockCount}, Requested: ${quantity}`,
      };
    }

    const previousStock = variant.stockCount;
    variant.stockCount -= quantity;

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

    const [staffUser, operator, mechanic] = await Promise.all([
      User.findById(personId).catch(() => null),
      Operator.findById(personId)
        .select({ profilePic: 0 })
        .catch(() => null),
      Mechanic.findById(personId).catch(() => null),
    ]);

    const assignedPerson = staffUser || operator || mechanic;

    if (assignedPerson) {
      if (!assignedPerson.toolkits) assignedPerson.toolkits = [];

      assignedPerson.toolkits.push({
        toolkitId: toolkit._id,
        toolkitName: toolkit.name,
        type: toolkit.type,
        variantId: variant._id,
        size: variant.size,
        color: variant.color,
        quantity,
        assignedDate,
        assignedBy: updatedBy,
        reason: reason || `Stock reduced: ${quantity} items used`,
        status: 'assigned',
      });

      await assignedPerson.save();
    }

    const savedToolkit = await toolkit.save();

    return {
      status: HTTP.OK,
      ok: true,
      message: 'Stock reduced successfully',
      data: savedToolkit,
    };
  } catch (err) {
    logger.error('[ToolkitService] reduceStock:', err);
    return {
      status: HTTP.INTERNAL_SERVER_ERROR,
      ok: false,
      message: 'Failed to reduce stock',
      error: err.message,
    };
  }
};

const deleteToolkit = async (toolkitId) => {
  try {
    const deleted = await Toolkit.findByIdAndDelete(toolkitId);
    if (!deleted)
      return {
        status: HTTP.NOT_FOUND,
        ok: false,
        message: `Toolkit with ID ${toolkitId} not found`,
      };

    return {
      status: HTTP.OK,
      ok: true,
      message: 'Toolkit deleted successfully',
      data: deleted,
    };
  } catch (err) {
    logger.error('[ToolkitService] deleteToolkit:', err);
    return {
      status: HTTP.INTERNAL_SERVER_ERROR,
      ok: false,
      message: 'Failed to delete toolkit',
      error: err.message,
    };
  }
};

const deleteVariant = async (toolkitId, variantId) => {
  try {
    const toolkit = await Toolkit.findById(toolkitId);
    if (!toolkit)
      return {
        status: HTTP.NOT_FOUND,
        ok: false,
        message: `Toolkit with ID ${toolkitId} not found`,
      };

    const variant = toolkit.variants.id(variantId);
    if (!variant)
      return {
        status: HTTP.NOT_FOUND,
        ok: false,
        message: `Variant with ID ${variantId} not found`,
      };

    toolkit.variants.pull(variantId);

    if (toolkit.variants.length === 0) {
      await Toolkit.findByIdAndDelete(toolkitId);
      return {
        status: HTTP.OK,
        ok: true,
        message: 'Toolkit deleted as no variants remain',
        data: null,
      };
    }

    const savedToolkit = await toolkit.save();
    return {
      status: HTTP.OK,
      ok: true,
      message: 'Variant deleted successfully',
      data: savedToolkit,
    };
  } catch (err) {
    logger.error('[ToolkitService] deleteVariant:', err);
    return {
      status: HTTP.INTERNAL_SERVER_ERROR,
      ok: false,
      message: 'Failed to delete variant',
      error: err.message,
    };
  }
};

const getStockHistory = async (toolkitId, variantId) => {
  try {
    const toolkit = await Toolkit.findById(toolkitId);
    if (!toolkit)
      return {
        status: HTTP.NOT_FOUND,
        ok: false,
        message: `Toolkit with ID ${toolkitId} not found`,
      };

    const variant = toolkit.variants.id(variantId);
    if (!variant)
      return {
        status: HTTP.NOT_FOUND,
        ok: false,
        message: `Variant with ID ${variantId} not found`,
      };

    return {
      status: HTTP.OK,
      ok: true,
      message: 'Stock history retrieved successfully',
      data: {
        toolkit: { name: toolkit.name, type: toolkit.type },
        variant: {
          size: variant.size,
          color: variant.color,
          currentStock: variant.stockCount,
          firstAddedDate: variant.firstAddedDate,
          lastUpdatedDate: variant.lastUpdatedDate,
        },
        stockHistory: [...variant.stockHistory].sort(
          (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
        ),
      },
    };
  } catch (err) {
    logger.error('[ToolkitService] getStockHistory:', err);
    return {
      status: HTTP.INTERNAL_SERVER_ERROR,
      ok: false,
      message: 'Failed to get stock history',
      error: err.message,
    };
  }
};

const getToolkitStockHistory = async (toolkitId) => {
  try {
    const toolkit = await Toolkit.findById(toolkitId);
    if (!toolkit)
      return {
        status: HTTP.NOT_FOUND,
        ok: false,
        message: `Toolkit with ID ${toolkitId} not found`,
      };

    return {
      status: HTTP.OK,
      ok: true,
      message: 'Toolkit stock history retrieved successfully',
      data: {
        toolkit: {
          name: toolkit.name,
          type: toolkit.type,
          createdAt: toolkit.createdAt,
        },
        variants: toolkit.variants.map((v) => ({
          _id: v._id,
          size: v.size,
          color: v.color,
          currentStock: v.stockCount,
          firstAddedDate: v.firstAddedDate,
          lastUpdatedDate: v.lastUpdatedDate,
          stockHistory: [...v.stockHistory].sort(
            (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
          ),
        })),
      },
    };
  } catch (err) {
    logger.error('[ToolkitService] getToolkitStockHistory:', err);
    return {
      status: HTTP.INTERNAL_SERVER_ERROR,
      ok: false,
      message: 'Failed to get toolkit stock history',
      error: err.message,
    };
  }
};

module.exports = {
  insertToolkit,
  fetchToolkits,
  searchToolkits,
  scanToolkitByBarcode,
  updateToolkit,
  updateVariant,
  reduceStock,
  deleteToolkit,
  deleteVariant,
  getStockHistory,
  getToolkitStockHistory,
};
