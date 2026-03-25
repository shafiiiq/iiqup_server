// ─────────────────────────────────────────────────────────────────────────────
// Stock Service
// Flat named async functions — no prototype objects, no class syntax.
// Follows the same conventions as equipment.service.js.
// ─────────────────────────────────────────────────────────────────────────────

const Stock              = require('../models/stock.model');
const stockHandoverModel = require('../models/images.model');
const userServices       = require('./user.service');
const mongoose           = require('mongoose');

const { createNotification }  = require('./notification.service');
const PushNotificationService = require('../push/notification.push');
const { default: wsUtils } = require('../sockets/websocket.js');
const analyser = require('../analyser/dashboard.analyser');

// ─────────────────────────────────────────────────────────────────────────────
// Internal: Notification helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fire-and-forget: creates an in-app notification + push notification.
 * Errors are logged but never surfaced to callers.
 * @param {string}      title
 * @param {string}      description
 * @param {string}      [priority='high']
 * @param {string|null} [recipient]
 * @param {string|null} [sourceId]
 */
const _sendNotification = async (title, description, priority = 'high', recipient = null, sourceId = null) => {
  try {
    const notification = await createNotification({
      title,
      description,
      priority,
      type:     'normal',
      sourceId,
      target:   recipient,
      time:     new Date()
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
    console.error('[StockService] Notification failed:', err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Stock CRUD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inserts a new stock record.
 * @param {object} data
 * @returns {Promise<object>}
 */
const insertStocks = async (data) => {
  try {
    if ( !data.product || !data.serialNumber || !data.type || data.rate      == null || data.rate === '' || data.stockCount == null || data.stockCount === '' ) {
       return { status: 400, ok: false, message: 'Missing required fields: product, type, serialNumber, rate, and stockCount are required' }
    }

    if (data.type === 'equipment' && !data.equipments) {
      return { status: 400, ok: false, message: 'Equipment number and name are required when type is equipment' };
    }

    const existingStock = await Stock.findOne({ serialNumber: data.serialNumber });
    if (existingStock) {
      return { status: 409, ok: false, message: 'Stock with this serial number already exists' };
    }

    const newStock = await new Stock({
      type:          data.type || 'stock',
      equipments:    data.type === 'equipment' ? data.equipments : null,
      product:       data.product,
      name:          data.name,
      description:   data.description,
      serialNumber:  data.serialNumber,
      date:          data.date ? new Date(data.date) : new Date(),
      rate:          parseFloat(data.rate),
      stockCount:    parseInt(data.stockCount),
      unit:          data.unit          || 'pcs',
      minThreshold:  data.minThreshold  || 5,
      maxThreshold:  data.maxThreshold  || 100,
      category:      data.category,
      subCategory:   data.subCategory,
      location:      data.location,
      warehouse:        data.warehouse,
      hasSubUnits:      data.hasSubUnits      || false,
      subUnitName:      data.subUnitName      || '',
      subUnitCapacity:  data.subUnitCapacity  || 0,
      subUnitRemaining: data.subUnitRemaining || 0,
    }).save();

    const officeHero = JSON.parse(process.env.OFFICE_HERO);
    await _sendNotification(
      'New Stock Added',
      `${data.stockCount} new ${data.serialNumber} - ${data.product} added to stock${newStock.equipments ? ` for ${newStock.equipments}` : ''}`,
      'high',
      officeHero,
      newStock._id
    );

    analyser.clearCache();
    wsUtils.sendDashboardUpdate('stocks');
    
    return { status: 201, ok: true, message: 'Stock added successfully', data: newStock };

  } catch (err) {
    console.error('[StockService] insertStocks:', err);

    if (err.code === 11000) {
      return { status: 409, ok: false, message: 'Duplicate serial number. Stock with this serial number already exists.' };
    }
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message).join(', ');
      return { status: 400, ok: false, message: `Validation error: ${messages}` };
    }

    return { status: 500, ok: false, message: 'Internal server error while adding stock', error: err.message };
  }
};

/**
 * Returns all stock records sorted by newest first.
 * @returns {Promise<object>}
 */
const fetchStocks = async () => {
  try {
    const stocks = await Stock.find({}).sort({ createdAt: -1 }).lean();
    return { status: 200, ok: true, message: 'Stocks fetched successfully', data: stocks, count: stocks.length };
  } catch (err) {
    console.error('[StockService] fetchStocks:', err);
    return { status: 500, ok: false, message: 'Internal server error while fetching stocks', error: err.message };
  }
};

/**
 * Returns stock records filtered by type ('stock' | 'equipment').
 * @param {string} type
 * @returns {Promise<object>}
 */
const fetchStocksByType = async (type) => {
  try {
    if (!['stock', 'equipment'].includes(type)) {
      return { status: 400, ok: false, message: 'Invalid type. Must be either "stock" or "equipment"' };
    }

    const stocks = await Stock.findByType(type).sort({ createdAt: -1 }).lean();
    return { status: 200, ok: true, message: `${type} stocks fetched successfully`, data: stocks, count: stocks.length };
  } catch (err) {
    console.error('[StockService] fetchStocksByType:', err);
    return { status: 500, ok: false, message: 'Internal server error while fetching stocks by type', error: err.message };
  }
};

/**
 * Returns stock records linked to a specific equipment number.
 * @param {string} equipmentNumber
 * @returns {Promise<object>}
 */
const fetchStocksByEquipment = async (equipmentNumber) => {
  try {
    if (!equipmentNumber) {
      return { status: 400, ok: false, message: 'Equipment number is required' };
    }

    const stocks = await Stock.findByEquipmentNumber(equipmentNumber).sort({ createdAt: -1 }).lean();
    return { status: 200, ok: true, message: 'Equipment stocks fetched successfully', data: stocks, count: stocks.length };
  } catch (err) {
    console.error('[StockService] fetchStocksByEquipment:', err);
    return { status: 500, ok: false, message: 'Internal server error while fetching equipment stocks', error: err.message };
  }
};

/**
 * Deletes a stock record by ID.
 * @param {string} stockId
 * @returns {Promise<object>}
 */
const deleteStock = async (stockId) => {
  try {
    if (!stockId) return { status: 400, ok: false, message: 'Stock ID is required' };

    const deleted = await Stock.findByIdAndDelete(stockId);
    if (!deleted) return { status: 404, ok: false, message: 'Stock not found' };

    return { status: 200, ok: true, message: 'Stock deleted successfully', data: deleted };
  } catch (err) {
    console.error('[StockService] deleteStock:', err);
    return { status: 500, ok: false, message: 'Internal server error while deleting stock', error: err.message };
  }
};

/**
 * Returns a single stock record by ID.
 * @param {string} stockId
 * @returns {Promise<object>}
 */
const getStockById = async (stockId) => {
  try {
    if (!stockId) return { status: 400, ok: false, message: 'Stock ID is required' }

    const stock = await Stock.findById(stockId).lean()
    if (!stock) return { status: 404, ok: false, success: false, message: 'Stock not found' }

    return { status: 200, ok: true, success: true, message: 'Stock fetched successfully', data: stock }
  } catch (err) {
    console.error('[StockService] getStockById:', err)
    return { status: 500, ok: false, message: 'Internal server error while fetching stock', error: err.message }
  }
}

/**
 * Returns paginated movement history for a single stock item.
 * @param {string} stockId
 * @param {number} limit
 * @param {number} offset
 * @returns {Promise<object>}
 */
const getStockMovements = async (stockId, limit = 50, offset = 0) => {
  try {
    if (!stockId) return { status: 400, ok: false, message: 'Stock ID is required' }

    const stock = await Stock.findById(stockId).lean()
    if (!stock) return { status: 404, ok: false, message: 'Stock not found' }

    const allMovements = [...(stock.movements || [])]
      .sort((a, b) => new Date(b.date) - new Date(a.date))

    const paginated = allMovements.slice(offset, offset + limit)

    return { status: 200, ok: true, data: paginated, total: allMovements.length, limit, offset }
  } catch (err) {
    console.error('[StockService] getStockMovements:', err)
    return { status: 500, ok: false, message: 'Internal server error while fetching movements', error: err.message }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Updates product-level fields (name, product, equipments, stockCount) on a stock record.
 * @param {string} stockId
 * @param {object} updateData
 * @returns {Promise<object>}
 */
const updateProduct = async (stockId, updateData) => {
  try {
    if (!stockId) return { status: 400, ok: false, message: 'Stock ID is required' };

    const current = await Stock.findById(stockId);
    if (!current) return { status: 404, ok: false, message: 'Stock not found' };

    const updated = await Stock.findByIdAndUpdate(
      stockId,
      {
        product:          updateData.product,
        serialNumber:     updateData.serialNumber,
        type:             updateData.type,
        equipments:       updateData.equipments,
        rate:             updateData.rate      !== undefined ? parseFloat(updateData.rate)   : undefined,
        stockCount:       updateData.stockCount !== undefined ? parseInt(updateData.stockCount) : undefined,
        date:             updateData.date      ? new Date(updateData.date) : undefined,
        hasSubUnits:      updateData.hasSubUnits,
        subUnitName:      updateData.hasSubUnits ? updateData.subUnitName     : '',
        subUnitCapacity:  updateData.hasSubUnits ? (updateData.subUnitCapacity || 0) : 0,
        subUnitRemaining: updateData.hasSubUnits ? (updateData.subUnitRemaining || updateData.subUnitCapacity || 0) : 0,
        updatedAt:        new Date(),
      },
      { new: true, runValidators: true }
    );

    return { status: 200, ok: true, message: 'Stock updated successfully', data: updated };
  } catch (err) {
    console.error('[StockService] updateProduct:', err);
    return { status: 500, ok: false, message: 'Internal server error while updating stock', error: err.message };
  }
};

/**
 * Updates a stock record, optionally recording a tracked movement (add / deduct / adjustment / initial).
 * For deductions, equipmentName and mechanicName are required.
 * @param {string} stockId
 * @param {object} updateData
 * @returns {Promise<object>}
 */
const updateStock = async (stockId, updateData) => {
  try {
    if (!stockId) return { status: 400, ok: false, message: 'Stock ID is required' }

    const currentStock = await Stock.findById(stockId)
    if (!currentStock) return { status: 404, ok: false, message: 'Stock not found' }

    const officeHero    = JSON.parse(process.env.OFFICE_HERO)
    const movementTypes = ['add', 'deduct', 'adjustment', 'initial']
    const isMovement    = movementTypes.includes(updateData.type)

    let updatedStock
    let quantityChange = 0

    if (isMovement) {
      if (updateData.type === 'deduct' && (!updateData.equipmentName || !updateData.mechanicName)) {
        return { status: 400, ok: false, message: 'Equipment name and mechanic name are required for deductions' }
      }

      let newQuantity
      let newSubUnitRemaining = currentStock.subUnitRemaining || 0
      let quantityChange      = parseInt(updateData.stockCount) || 0

      // ── Sub-unit deduct path ──────────────────────────────────────────────
      if (currentStock.hasSubUnits && updateData.type === 'deduct' && updateData.reduceType === 'subunit') {
        let toDeduct   = quantityChange
        let remaining  = currentStock.subUnitRemaining || 0
        let containers = currentStock.stockCount       || 0

        while (toDeduct > 0) {
          if (remaining === 0) {
            if (containers > 0) {
              containers -= 1
              remaining   = currentStock.subUnitCapacity || 0
            } else {
              break
            }
          }
          if (toDeduct <= remaining) {
            remaining -= toDeduct
            toDeduct   = 0
          } else {
            toDeduct  -= remaining
            remaining  = 0
          }
        }

        // If remaining hits 0 and there are still containers, open the next one
        if (remaining === 0 && containers > 0) {
          containers -= 1
          remaining   = currentStock.subUnitCapacity || 0
        }

        newQuantity         = containers
        newSubUnitRemaining = remaining

      // ── Normal stock deduct path ──────────────────────────────────────────
      } else if (updateData.type === 'deduct') {
        newQuantity         = currentStock.stockCount - quantityChange
        newSubUnitRemaining = currentStock.subUnitRemaining || 0

      // ── Add path ──────────────────────────────────────────────────────────
      } else if (updateData.type === 'add') {
        newQuantity         = currentStock.stockCount + quantityChange
        newSubUnitRemaining = currentStock.subUnitRemaining || 0

      // ── Adjustment ────────────────────────────────────────────────────────
      } else {
        newQuantity         = quantityChange
        newSubUnitRemaining = currentStock.subUnitRemaining || 0
      }

      const movementData = {
        date:             updateData.date || new Date(),
        time:             updateData.time || new Date().toLocaleTimeString(),
        type:             updateData.type,
        reduceType:       updateData.reduceType || 'stock',
        quantity:         quantityChange,
        subUnitAmount:    updateData.reduceType === 'subunit' ? quantityChange : 0,
        previousQuantity: currentStock.stockCount,
        newQuantity,
        reason:           updateData.reason || `Stock ${updateData.type}`,
        notes:            updateData.notes  || '',
        createdAt:        new Date(),
        ...(updateData.createdBy ? { createdBy: updateData.createdBy } : {}),
        ...(updateData.type === 'deduct' ? {
          equipmentName:      updateData.equipmentName,
          equipmentNumber:    updateData.equipmentNumber || '',
          mechanicName:       updateData.mechanicName,
          mechanicEmployeeId: '1'
        } : {})
      }

      updatedStock = await Stock.findByIdAndUpdate(
        stockId,
        {
          stockCount:       newQuantity,
          subUnitRemaining: newSubUnitRemaining,
          $push:            { movements: movementData },
          updatedAt:        new Date()
        },
        { new: true, runValidators: true }
      )

    } else {
      // Regular field update — strip movement-only keys before persisting
      const {
        type, equipmentId, equipmentName, equipmentNumber,
        mechanicId, mechanicName, mechanicEmployeeId,
        date, time, reason, notes, createdBy,
        reduceType, subUnitAmount,
        ...regularUpdateData
      } = updateData

      updatedStock = await Stock.findByIdAndUpdate(
        stockId,
        { ...regularUpdateData, updatedAt: new Date() },
        { new: true, runValidators: true }
      )
    }

    // ── Low / out-of-stock alerts ─────────────────────────────────────────
    // if (updatedStock.stockCount < 10) {
    //   const message = updatedStock.stockCount === 0
    //     ? `Urgent Requirement: ${currentStock.product} with part number ${currentStock.serialNumber} is out of stock`
    //     : `Urgent Requirement: ${currentStock.product} with part number ${currentStock.serialNumber} is low in stock — only ${updatedStock.stockCount} items left`

    //   await userServices.pushSpecialNotification(
    //     process.env.JALEEL_KA,
    //     updatedStock.stockCount,
    //     stockId,
    //     message
    //   ).catch(e => console.error('[StockService] Low stock notification failed:', e))

    //   await PushNotificationService.sendGeneralNotification(
    //     officeHero,
    //     'Low Stock',
    //     message,
    //     'high',
    //     'normal'
    //   )
    // } else {
    //   await _sendNotification(
    //     'Stock Update',
    //     `${quantityChange} ${currentStock.product} with part number ${currentStock.serialNumber} is used by ${updateData.mechanicName} for ${updateData.equipmentName} ${updateData.equipmentNumber}`,
    //     'high',
    //     officeHero
    //   )
    // }

    return { status: 200, ok: true, message: 'Stock updated successfully', data: updatedStock }

  } catch (err) {
    console.error('[StockService] updateStock:', err)

    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message).join(', ')
      return { status: 400, ok: false, message: `Validation error: ${messages}` }
    }
    if (err.name === 'CastError') {
      return { status: 400, ok: false, message: 'Invalid stock ID format' }
    }
    if (err.code === 11000) {
      return { status: 409, ok: false, message: 'Duplicate entry — this stock item already exists' }
    }

    return { status: 500, ok: false, message: 'Internal server error while updating stock', error: err.message }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Movements / Reports
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns all stock movement records enriched with their parent stock information,
 * plus aggregate statistics.
 * @returns {Promise<object>}
 */
const getMovementsWithStock = async () => {
  try {
    const stocks = await Stock.find({});

    let totalStocks        = 0;
    let totalCost          = 0;
    let totalQuantityUsed  = 0;
    const stockSummary     = [];
    const results          = [];

    stocks.forEach(stock => {
      const currentStockCount = stock.stockCount || 0;
      const rate              = stock.rate        || 0;
      const stockValue        = currentStockCount * rate;

      let quantityUsed  = 0;
      let addedQuantity = 0;

      (stock.movements || []).forEach(m => {
        if (m.type === 'deduct') quantityUsed  += m.quantity || 0;
        if (m.type === 'add')    addedQuantity += m.quantity || 0;
      });

      totalStocks       += currentStockCount;
      totalCost         += stockValue;
      totalQuantityUsed += quantityUsed;

      stockSummary.push({
        stockId: stock._id, product: stock.product, name: stock.name,
        currentStockCount, rate, stockValue, quantityUsed, addedQuantity,
        totalMovements: stock.movements?.length || 0
      });

      (stock.movements || []).forEach(movement => {
        results.push({
          stockInfo: {
            stockId: stock._id, product: stock.product, description: stock.description,
            serialNumber: stock.serialNumber, currentStockCount: stock.stockCount,
            rate: stock.rate, unit: stock.unit, status: stock.status,
            category: stock.category, subCategory: stock.subCategory,
            location: stock.location, warehouse: stock.warehouse,
            minThreshold: stock.minThreshold, maxThreshold: stock.maxThreshold,
            totalValue: stock.totalValue
          },
          movementInfo: {
            movementId: movement._id, date: movement.date, time: movement.time,
            type: movement.type, quantity: movement.quantity,
            previousQuantity: movement.previousQuantity, newQuantity: movement.newQuantity,
            reason: movement.reason, notes: movement.notes, createdAt: movement.createdAt
          },
          equipmentInfo: movement.type === 'deduct'
            ? { equipmentId: movement.equipmentId, equipmentName: movement.equipmentName, equipmentNumber: movement.equipmentNumber }
            : null,
          mechanicInfo: movement.type === 'deduct'
            ? { mechanicId: movement.mechanicId, mechanicName: movement.mechanicName, mechanicEmployeeId: movement.mechanicEmployeeId }
            : null
        });
      });
    });

    results.sort((a, b) => new Date(b.movementInfo.date) - new Date(a.movementInfo.date));

    return {
      status:  200,
      ok:      true,
      message: 'Movements with stock information retrieved successfully',
      data:    results,
      count:   results.length,
      statistics: { totalStocks, totalCost, totalQuantityUsed, totalStockItems: stocks.length, stockSummary }
    };
  } catch (err) {
    console.error('[StockService] getMovementsWithStock:', err);
    return { status: 500, ok: false, message: 'Error retrieving movements with stock information', error: err.message };
  }
};

/**
 * Returns all stock movements for a specific equipment.
 * @param {string} equipmentId
 * @returns {Promise<object>}
 */
const getStockMovementsByEquipment = async (equipmentId) => {
  try {
    const movements = await Stock.getMovementsByEquipment(equipmentId);
    return { status: 200, ok: true, data: movements };
  } catch (err) {
    console.error('[StockService] getStockMovementsByEquipment:', err);
    return { status: 500, ok: false, message: 'Error retrieving stock movements for equipment', error: err.message };
  }
};

/**
 * Returns all stock movements performed by a specific mechanic.
 * @param {string} mechanicId
 * @returns {Promise<object>}
 */
const getStockMovementsByMechanic = async (mechanicId) => {
  try {
    const movements = await Stock.getMovementsByMechanic(mechanicId);
    return { status: 200, ok: true, data: movements };
  } catch (err) {
    console.error('[StockService] getStockMovementsByMechanic:', err);
    return { status: 500, ok: false, message: 'Error retrieving stock movements for mechanic', error: err.message };
  }
};

/**
 * Generates a stock accountability report for deduction movements within a date range.
 * @param {string} startDate
 * @param {string} endDate
 * @returns {Promise<object>}
 */
const getStockAccountabilityReport = async (startDate, endDate) => {
  try {
    const start = new Date(startDate);
    const end   = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const result = await Stock.aggregate([
      { $match: { isDeleted: { $ne: true }, movements: { $exists: true, $ne: [] } } },
      { $unwind: '$movements' },
      { $match: { 'movements.type': 'deduct', 'movements.date': { $gte: start, $lte: end } } },
      {
        $project: {
          date:               '$movements.date',
          time:               '$movements.time',
          stockItem:          '$product',
          product:            '$product',
          serialNumber:       '$serialNumber',
          quantityTaken:      '$movements.quantity',
          rate:               '$rate',
          totalValue:         { $multiply: ['$movements.quantity', '$rate'] },
          mechanicName:       { $ifNull: ['$movements.mechanicName',       'Unknown'] },
          mechanicId:         '$movements.mechanicId',
          mechanicEmployeeId: { $ifNull: ['$movements.mechanicEmployeeId', 'Unknown'] },
          equipmentName:      { $ifNull: ['$movements.equipmentName',      'Unknown'] },
          equipmentNumber:    { $ifNull: ['$movements.equipmentNumber',    'Unknown'] },
          equipmentId:        '$movements.equipmentId',
          reason:             { $ifNull: ['$movements.reason', 'No reason provided'] },
          notes:              { $ifNull: ['$movements.notes',  ''] }
        }
      },
      { $sort: { date: -1 } }
    ]);

    const totalValue = result.reduce((sum, item) => sum + item.totalValue, 0);

    return {
      status:  200,
      ok:      true,
      data:    result,
      summary: { totalTransactions: result.length, totalValue, dateRange: { startDate, endDate } }
    };
  } catch (err) {
    console.error('[StockService] getStockAccountabilityReport:', err);
    return { status: 500, ok: false, message: 'Error generating stock accountability report', error: err.message };
  }
};

/**
 * Looks up a stock record by its ObjectId (barcode scan).
 * @param {string} objectId
 * @returns {Promise<object>}
 */
const scanStockByBarcode = async (objectId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(objectId)) {
      return { status: 400, ok: false, message: 'Invalid barcode format. Please scan a valid stock barcode.' };
    }

    const stock = await Stock.findOne({ _id: objectId, isDeleted: { $ne: true } });
    if (!stock) {
      return { status: 404, ok: false, message: 'Stock not found. This item may have been deleted or does not exist.' };
    }

    const result = stock.toObject();

    // Sort movements newest-first
    if (result.movements?.length) {
      result.movements.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    const totalMovements = result.movements?.length       || 0;
    const totalAdded     = (result.movements || []).filter(m => m.type === 'add').reduce((s, m) => s + (m.quantity || 0), 0);
    const totalDeducted  = (result.movements || []).filter(m => m.type === 'deduct').reduce((s, m) => s + (m.quantity || 0), 0);

    const lastMovement = result.movements?.[0] ?? null;
    const lastActivity = lastMovement?.date ?? null;
    const lastActionBy = lastMovement
      ? lastMovement.type === 'deduct'
        ? (lastMovement.mechanicName || 'Unknown')
        : `System (${lastMovement.reason || 'Stock Added'})`
      : null;

    return {
      status:  200,
      ok:      true,
      message: 'Stock scanned successfully',
      data: {
        ...result,
        metrics: {
          totalMovements,
          totalAdded,
          totalDeducted,
          lastActivity,
          lastActionBy,
          totalValue: stock.rate * stock.stockCount,
          stockAge:   Math.floor((Date.now() - new Date(stock.createdAt)) / (1000 * 60 * 60 * 24))
        }
      }
    };
  } catch (err) {
    console.error('[StockService] scanStockByBarcode:', err);
    return { status: 500, ok: false, message: 'Error scanning stock barcode', error: err.message };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Stock CRUD
  insertStocks,
  fetchStocks,
  fetchStocksByType,
  fetchStocksByEquipment,
  getStockById,
  deleteStock,
  // Update
  updateProduct,
  updateStock,
  // Movements / Reports
  getMovementsWithStock,
  getStockMovements,
  getStockMovementsByEquipment,
  getStockMovementsByMechanic,
  getStockAccountabilityReport,
  scanStockByBarcode
};