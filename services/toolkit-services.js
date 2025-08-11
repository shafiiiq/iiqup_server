const Toolkit = require('../models/toolkit.model');
const { createNotification } = require('../utils/notification-jobs'); // Import notification service
const PushNotificationService = require('../utils/push-notification-jobs');

/**
 * Helper function to add stock history entry
 */
const addStockHistoryEntry = (variant, action, previousStock, newStock, reason = '', updatedBy = 'System') => {
  const validPreviousStock = Number(previousStock) || 0;
  const validNewStock = Number(newStock) || 0;
  const changeAmount = validNewStock - validPreviousStock;

  variant.stockHistory.push({
    action,
    previousStock: validPreviousStock,
    newStock: validNewStock,
    changeAmount,
    reason,
    size: variant.size,      // Will now have actual value
    color: variant.color,    // Will now have actual value
    timestamp: new Date(),
    updatedBy
  });
};

/**
 * Insert a new toolkit or add variant to existing toolkit
 * @param {Object} toolkitData - The toolkit data to insert
 * @returns {Promise} - Promise with the result of the operation
 */
const insertToolkit = async (toolkitData) => {
  try {
    const { name, type, size, color, stockCount, minStockLevel, reason, updatedBy } = toolkitData;

    // Normalize the name for comparison
    const normalizedName = name.trim().toLowerCase();

    // Check if a toolkit with similar name already exists
    const existingToolkit = await Toolkit.findOne({
      name: { $regex: new RegExp(`^${normalizedName}$`, 'i') }
    });

    if (existingToolkit) {
      // Check if this exact variant (size + color) already exists
      const existingVariant = existingToolkit.variants.find(
        variant => variant.size?.toLowerCase() === size?.toLowerCase() &&
          variant.color?.toLowerCase() === color?.toLowerCase()
      );

      if (existingVariant) {
        // Update existing variant stock and add history
        const previousStock = existingVariant.stockCount;
        existingVariant.stockCount += stockCount;
        existingVariant.minStockLevel = minStockLevel || existingVariant.minStockLevel;

        // Add stock history entry
        addStockHistoryEntry(
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
          size: size || 'N/A',
          color: color || 'N/A',
          stockCount,
          minStockLevel: minStockLevel || 5,
          inuse: false,
          firstAddedDate: new Date(),
          lastUpdatedDate: new Date(),
          stockHistory: []
        };

        // Add initial stock history entry
        addStockHistoryEntry(
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

      await createNotification({
        title: "New Safety items Added",
        description: `New ${equipment.stockCount} ${equipment.name} added to stock`,
        priority: "high",
        sourceId: equipment._id,
        time: new Date()
      });

      await PushNotificationService.sendGeneralNotification(
        null, // broadcast to all users
        "New Safety items Added", //title
        `New ${equipment.stockCount} ${equipment.name} added to stock`, //decription
        'high', //priority
        'normal' // type
      );

      return {
        status: 200,
        success: true,
        message: existingVariant ? 'Variant stock updated successfully' : 'New variant added successfully',
        data: savedToolkit
      };
    } else {
      // Create new toolkit with first variant
      const newVariant = {
        size: size || 'N/A',
        color: color || 'N/A',
        stockCount,
        minStockLevel: minStockLevel || 5,
        inuse: false,
        firstAddedDate: new Date(),
        lastUpdatedDate: new Date(),
        stockHistory: []
      };

      // Add initial stock history entry
      addStockHistoryEntry(
        newVariant,
        'initial',
        0,
        stockCount,
        reason || `Initial stock for new toolkit: ${name}`,
        updatedBy || 'System'
      );

      const newToolkit = new Toolkit({
        name: name.trim(),
        type,
        variants: [newVariant]
      });

      const savedToolkit = await newToolkit.save();

      return {
        status: 201,
        success: true,
        message: 'Toolkit added successfully',
        data: savedToolkit
      };
    }
  } catch (error) {
    return {
      status: 400,
      success: false,
      message: 'Failed to add toolkit',
      error: error.message
    };
  }
};

/**
 * Update a specific variant of a toolkit
 * @param {string} toolkitId - The ID of the toolkit
 * @param {string} variantId - The ID of the variant to update
 * @param {Object} updateData - The data to update
 * @returns {Promise} - Promise with the result of the operation
 */
const updateVariant = async (toolkitId, variantId, updateData) => {
  try {
    const toolkit = await Toolkit.findById(toolkitId);

    if (!toolkit) {
      return {
        status: 404,
        success: false,
        message: `Toolkit with ID ${toolkitId} not found`
      };
    }

    const variant = toolkit.variants.id(variantId);
    if (!variant) {
      return {
        status: 404,
        success: false,
        message: `Variant with ID ${variantId} not found`
      };
    }

    let action
    let previousStock

    // Track stock changes if stockCount is being updated
    if (updateData.stockCount !== undefined && updateData.stockCount !== variant.stockCount) {
      previousStock = variant.stockCount;
      const newStock = updateData.stockCount;
      action = newStock > previousStock ? 'added' : 'reduced';
      const reason = updateData.reason || `Stock ${action}: ${Math.abs(newStock - previousStock)} items`;

      console.log(action);

      addStockHistoryEntry(
        variant,
        action,
        previousStock,
        newStock,
        reason,
        updateData.updatedBy || 'System'
      );
    }

    // Update variant fields
    Object.keys(updateData).forEach(key => {
      if (key in variant && key !== 'reason' && key !== 'updatedBy') {
        variant[key] = updateData[key];
      }
    });

    const savedToolkit = await toolkit.save();

    await createNotification({
      title: "Safety items update",
      description: `${updateData.stockCount < previousStock ? previousStock - updateData.stockCount : updateData.stockCount - previousStock} items ${action} in Size:${variant.size} - Color:${variant.color} - ${toolkit.name}`,
      priority: "high",
      sourceId: toolkit._id, // Changed from equipment._id to toolkit._id
      time: new Date()
    });

    await PushNotificationService.sendGeneralNotification(
      null, // broadcast to all users
      "Safety items update", //title
      `${updateData.stockCount < previousStock ? previousStock - updateData.stockCount : updateData.stockCount - previousStock} items ${action} in Size:${variant.size} - Color:${variant.color} - ${toolkit.name}`, //description
      'high', //priority
      'normal' // type
    );

    return {
      status: 200,
      success: true,
      message: 'Variant updated successfully',
      data: savedToolkit
    };
  } catch (error) {
    return {
      status: 400,
      success: false,
      message: 'Failed to update variant',
      error: error.message
    };
  }
};

/**
 * Reduce stock for a specific variant
 * @param {string} toolkitId - The ID of the toolkit
 * @param {string} variantId - The ID of the variant
 * @param {number} quantity - The quantity to reduce
 * @param {string} reason - The reason for reduction
 * @param {string} updatedBy - Who made the change
 * @returns {Promise} - Promise with the result of the operation
 */
const reduceStock = async (toolkitId, variantId, quantity, reason = '', updatedBy = 'System', person) => {
  try {
    const toolkit = await Toolkit.findById(toolkitId);

    if (!toolkit) {
      return {
        status: 404,
        success: false,
        message: `Toolkit with ID ${toolkitId} not found`
      };
    }

    const variant = toolkit.variants.id(variantId);
    if (!variant) {
      return {
        status: 404,
        success: false,
        message: `Variant with ID ${variantId} not found`
      };
    }

    if (variant.stockCount < quantity) {
      return {
        status: 400,
        success: false,
        message: `Insufficient stock. Available: ${variant.stockCount}, Requested: ${quantity}`
      };
    }

    const previousStock = variant.stockCount;
    variant.stockCount -= quantity;

    // Add stock history entry
    addStockHistoryEntry(
      variant,
      'reduced',
      previousStock,
      variant.stockCount,
      reason || `Stock reduced: ${quantity} items used`,
      updatedBy,
      person
    );

    const savedToolkit = await toolkit.save();

    await createNotification({
      title: "Safety items update",
      description: `${quantity} Size:${variant.size} Color:${variant.color} ${toolkit.name} handovered to ${person}`,
      priority: "high", //priority
      'type': 'normal'// type
    });

    await PushNotificationService.sendGeneralNotification(
      null, // broadcast to all users
      "Safety items update", //title
      `${quantity} Size:${variant.size} Color:${variant.color} ${toolkit.name} handovered to ${person}`, //decription
      'high', //priority
      'normal' // type
    );

    return {
      status: 200,
      success: true,
      message: 'Stock reduced successfully',
      data: savedToolkit
    };
  } catch (error) {
    return {
      status: 400,
      success: false,
      message: 'Failed to reduce stock',
      error: error.message
    };
  }
};

/**
 * Get stock history for a specific variant
 * @param {string} toolkitId - The ID of the toolkit
 * @param {string} variantId - The ID of the variant
 * @returns {Promise} - Promise with the result of the operation
 */
const getStockHistory = async (toolkitId, variantId) => {
  try {
    const toolkit = await Toolkit.findById(toolkitId);

    if (!toolkit) {
      return {
        status: 404,
        success: false,
        message: `Toolkit with ID ${toolkitId} not found`
      };
    }

    const variant = toolkit.variants.id(variantId);
    if (!variant) {
      return {
        status: 404,
        success: false,
        message: `Variant with ID ${variantId} not found`
      };
    }

    return {
      status: 200,
      success: true,
      message: 'Stock history retrieved successfully',
      data: {
        toolkit: {
          name: toolkit.name,
          type: toolkit.type
        },
        variant: {
          size: variant.size,
          color: variant.color,
          currentStock: variant.stockCount,
          firstAddedDate: variant.firstAddedDate,
          lastUpdatedDate: variant.lastUpdatedDate
        },
        stockHistory: variant.stockHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      }
    };
  } catch (error) {
    return {
      status: 400,
      success: false,
      message: 'Failed to get stock history',
      error: error.message
    };
  }
};

/**
 * Get all stock history for all variants of a toolkit
 * @param {string} toolkitId - The ID of the toolkit
 * @returns {Promise} - Promise with the result of the operation
 */
const getToolkitStockHistory = async (toolkitId) => {
  try {
    const toolkit = await Toolkit.findById(toolkitId);

    if (!toolkit) {
      return {
        status: 404,
        success: false,
        message: `Toolkit with ID ${toolkitId} not found`
      };
    }

    const historyData = {
      toolkit: {
        name: toolkit.name,
        type: toolkit.type,
        createdAt: toolkit.createdAt
      },
      variants: toolkit.variants.map(variant => ({
        _id: variant._id,
        size: variant.size,
        color: variant.color,
        currentStock: variant.stockCount,
        firstAddedDate: variant.firstAddedDate,
        lastUpdatedDate: variant.lastUpdatedDate,
        stockHistory: variant.stockHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      }))
    };

    return {
      status: 200,
      success: true,
      message: 'Toolkit stock history retrieved successfully',
      data: historyData
    };
  } catch (error) {
    return {
      status: 400,
      success: false,
      message: 'Failed to get toolkit stock history',
      error: error.message
    };
  }
};

/**
 * Fetch all toolkits from the database
 * @returns {Promise} - Promise with the result of the operation
 */
const fetchToolkits = async () => {
  try {
    const toolkits = await Toolkit.find({}).sort({ createdAt: -1 });

    return {
      status: 200,
      success: true,
      message: 'Toolkits fetched successfully',
      data: toolkits
    };
  } catch (error) {
    return {
      status: 400,
      success: false,
      message: 'Failed to fetch toolkits',
      error: error.message
    };
  }
};

/**
 * Update a toolkit by ID
 * @param {string} toolkitId - The ID of the toolkit to update
 * @param {Object} updateData - The data to update
 * @returns {Promise} - Promise with the result of the operation
 */
const updateToolkit = async (toolkitId, updateData) => {
  try {
    // First, get the current toolkit to access variants
    const currentToolkit = await Toolkit.findById(toolkitId);

    if (!currentToolkit) {
      return {
        status: 404,
        success: false,
        message: `Toolkit with ID ${toolkitId} not found`
      };
    }

    // Calculate total stock from all variants
    let totalStock = 0;

    // If updateData contains variants, use the updated variants
    const variants = updateData.variants || currentToolkit.variants;

    if (variants && Array.isArray(variants)) {
      totalStock = variants.reduce((sum, variant) => {
        return sum + (variant.stockCount || 0);
      }, 0);
    }

    // Determine overall status based on total stock and variant statuses
    let overallStatus = 'out';
    if (totalStock > 0) {
      const hasAvailable = variants.some(variant =>
        variant.stockCount > 0 && variant.status === 'available'
      );
      overallStatus = hasAvailable ? 'available' : 'low';
    }

    // Update the toolkit with calculated values
    const updatedToolkit = await Toolkit.findByIdAndUpdate(
      toolkitId,
      {
        ...updateData,
        totalStock: totalStock,
        overallStatus: overallStatus,
        updatedAt: Date.now()
      },
      { new: true, runValidators: true }
    );

    console.log('Updated toolkit:', updatedToolkit);

    return {
      status: 200,
      success: true,
      message: 'Toolkit updated successfully',
      data: updatedToolkit
    };

  } catch (error) {
    console.error('Error updating toolkit:', error);
    return {
      status: 400,
      success: false,
      message: 'Failed to update toolkit',
      error: error.message
    };
  }
};

/**
 * Delete a toolkit by ID
 * @param {string} toolkitId - The ID of the toolkit to delete
 * @returns {Promise} - Promise with the result of the operation
 */
const deleteToolkit = async (toolkitId) => {
  try {
    const deletedToolkit = await Toolkit.findByIdAndDelete(toolkitId);

    if (!deletedToolkit) {
      return {
        status: 404,
        success: false,
        message: `Toolkit with ID ${toolkitId} not found`
      };
    }

    return {
      status: 200,
      success: true,
      message: 'Toolkit deleted successfully',
      data: deletedToolkit
    };
  } catch (error) {
    return {
      status: 400,
      success: false,
      message: 'Failed to delete toolkit',
      error: error.message
    };
  }
};

/**
 * Delete a specific variant from a toolkit
 * @param {string} toolkitId - The ID of the toolkit
 * @param {string} variantId - The ID of the variant to delete
 * @returns {Promise} - Promise with the result of the operation
 */
const deleteVariant = async (toolkitId, variantId) => {
  try {
    const toolkit = await Toolkit.findById(toolkitId);

    if (!toolkit) {
      return {
        status: 404,
        success: false,
        message: `Toolkit with ID ${toolkitId} not found`
      };
    }

    const variant = toolkit.variants.id(variantId);
    if (!variant) {
      return {
        status: 404,
        success: false,
        message: `Variant with ID ${variantId} not found`
      };
    }

    // Remove the variant
    toolkit.variants.pull(variantId);

    // If no variants left, delete the entire toolkit
    if (toolkit.variants.length === 0) {
      await Toolkit.findByIdAndDelete(toolkitId);
      return {
        status: 200,
        success: true,
        message: 'Toolkit deleted as no variants remain',
        data: null
      };
    }

    const savedToolkit = await toolkit.save();

    return {
      status: 200,
      success: true,
      message: 'Variant deleted successfully',
      data: savedToolkit
    };
  } catch (error) {
    return {
      status: 400,
      success: false,
      message: 'Failed to delete variant',
      error: error.message
    };
  }
};

/**
 * Search toolkits by name (fuzzy search)
 * @param {string} searchTerm - The search term
 * @returns {Promise} - Promise with the result of the operation
 */
const searchToolkits = async (searchTerm) => {
  try {
    const toolkits = await Toolkit.find({
      name: { $regex: new RegExp(searchTerm, 'i') }
    }).sort({ createdAt: -1 });

    return {
      status: 200,
      success: true,
      message: 'Search completed successfully',
      data: toolkits
    };
  } catch (error) {
    return {
      status: 400,
      success: false,
      message: 'Failed to search toolkits',
      error: error.message
    };
  }
};

module.exports = {
  insertToolkit,
  fetchToolkits,
  updateToolkit,
  updateVariant,
  deleteToolkit,
  deleteVariant,
  searchToolkits,
  reduceStock,
  getStockHistory,
  getToolkitStockHistory
};