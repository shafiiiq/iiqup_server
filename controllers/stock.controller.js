// controllers/stocks.controller.js
const stockServices     = require('../services/stock.service.js');

// ─────────────────────────────────────────────────────────────────────────────
// Stock CRUD Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /stocks
 * Adds a new stock record.
 */
const addStocks = async (req, res) => {
  try {
    const result = await stockServices.insertStocks(req.body);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Stocks] addStocks:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * GET /stocks
 * Returns all stock records.
 */
const getStocks = async (req, res) => {
  try {
    const result = await stockServices.fetchStocks();

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Stocks] getStocks:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * GET /stocks/type/:type
 * Returns all stock records filtered by type.
 */
const getStocksByType = async (req, res) => {
  try {
    const { type } = req.params;

    if (!type) {
      return res.status(400).json({ success: false, message: 'Stock type is required' });
    }

    const result = await stockServices.fetchStocksByType(type);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Stocks] getStocksByType:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * GET /stocks/equipment-number/:equipmentNumber
 * Returns all stock records for a specific equipment number.
 */
const getStocksByEquipment = async (req, res) => {
  try {
    const { equipmentNumber } = req.params;

    if (!equipmentNumber) {
      return res.status(400).json({ success: false, message: 'Equipment number is required' });
    }

    const result = await stockServices.fetchStocksByEquipment(equipmentNumber);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Stocks] getStocksByEquipment:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * GET /stocks/:stockId
 * Returns a single stock record by ID.
 */
const getStockById = async (req, res) => {
  try {
    const { stockId } = req.params;

    if (!stockId) {
      return res.status(400).json({ success: false, message: 'Stock ID is required' });
    }

    const result = await stockServices.getStockById(stockId);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Stocks] getStockById:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /stocks/product/:stockId
 * Updates product details for a stock record.
 */
const updateProduct = async (req, res) => {
  try {
    const { stockId } = req.params;

    if (!stockId) {
      return res.status(400).json({ success: false, message: 'Stock ID is required' });
    }

    const result = await stockServices.updateProduct(stockId, req.body);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Stocks] updateProduct:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /stocks/:stockId
 * Updates a stock record with optional movement tracking.
 */
const updateStock = async (req, res) => {
  try {
    const { stockId } = req.params;

    if (!stockId) {
      return res.status(400).json({ success: false, message: 'Stock ID is required' });
    }

    if (req.body.type === 'deduct') {
      const requiredFields  = ['equipmentName', 'mechanicName'];
      const missingFields   = requiredFields.filter(field => !req.body[field]);

      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Missing required fields for deduction: ${missingFields.join(', ')}`,
        });
      }
    }

    const result = await stockServices.updateStock(stockId, req.body);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Stocks] updateStock:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /stocks/:id
 * Deletes a stock record by ID.
 */
const deleteStock = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ success: false, message: 'Stock ID is required' });
    }

    const result = await stockServices.deleteStock(id);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Stocks] deleteStock:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Stock Quantity Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PUT /stocks/:stockId/add
 * Adds quantity to a stock item with movement tracking.
 */
const addStockQuantity = async (req, res) => {
  try {
    const { stockId }                        = req.params;
    const { quantity, reason, notes, createdBy } = req.body;

    if (!quantity || quantity <= 0) {
      return res.status(400).json({ success: false, message: 'Valid quantity is required' });
    }

    const currentStock = await stockServices.getStockById(stockId);

    if (!currentStock.success) {
      return res.status(currentStock.status).json(currentStock);
    }

    const updateData = {
      type:       'add',
      stockCount: currentStock.data.stockCount + quantity,
      reason:     reason    || 'Stock addition',
      notes:      notes     || '',
      createdBy:  createdBy || 'System',
    };

    const result = await stockServices.updateStock(stockId, updateData);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Stocks] addStockQuantity:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /stocks/:stockId/deduct
 * Deducts quantity from a stock item with movement tracking.
 */
const deductStockQuantity = async (req, res) => {
  try {
    const { stockId } = req.params;
    const {
      quantity, equipmentId, mechanicId, equipmentName, mechanicName,
      equipmentNumber, reason, notes, createdBy,
    } = req.body;

    if (!quantity || quantity <= 0) {
      return res.status(400).json({ success: false, message: 'Valid quantity is required' });
    }

    if (!equipmentId || !mechanicId || !equipmentName || !mechanicName) {
      return res.status(400).json({
        success: false,
        message: 'equipmentId, mechanicId, equipmentName, and mechanicName are required',
      });
    }

    const currentStock = await stockServices.getStockById(stockId);

    if (!currentStock.success) {
      return res.status(currentStock.status).json(currentStock);
    }

    if (currentStock.data.stockCount < quantity) {
      return res.status(400).json({ success: false, message: 'Insufficient stock quantity' });
    }

    const updateData = {
      type:            'deduct',
      stockCount:      currentStock.data.stockCount - quantity,
      equipmentId,
      mechanicId,
      equipmentName,
      mechanicName,
      equipmentNumber: equipmentNumber || '',
      reason:          reason    || 'Stock deduction',
      notes:           notes     || '',
      createdBy:       createdBy || 'System',
    };

    const result = await stockServices.updateStock(stockId, updateData);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Stocks] deductStockQuantity:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /stocks/:stockId/adjust
 * Sets a stock item to a new quantity with movement tracking.
 */
const adjustStockQuantity = async (req, res) => {
  try {
    const { stockId }                              = req.params;
    const { newQuantity, reason, notes, createdBy } = req.body;

    if (newQuantity === undefined || newQuantity < 0) {
      return res.status(400).json({ success: false, message: 'Valid new quantity is required' });
    }

    const updateData = {
      type:       'adjustment',
      stockCount: newQuantity,
      reason:     reason    || 'Stock adjustment',
      notes:      notes     || '',
      createdBy:  createdBy || 'System',
    };

    const result = await stockServices.updateStock(stockId, updateData);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Stocks] adjustStockQuantity:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Movement & Tracking Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /stocks/movements
 * Returns all stock movements, optionally filtered by equipment, mechanic, type, or date range.
 */
const getMovementsWithStock = async (req, res) => {
  try {
    const filters = Object.fromEntries(
      Object.entries({
        equipmentId: req.query.equipmentId,
        mechanicId:  req.query.mechanicId,
        type:        req.query.type,
        startDate:   req.query.startDate,
        endDate:     req.query.endDate,
      }).filter(([, v]) => v !== undefined)
    );

    const result = await stockServices.getMovementsWithStock(filters);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Stocks] getMovementsWithStock:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * GET /stocks/:stockId/movements
 * Returns movement history for a specific stock item.
 */
const getStockMovements = async (req, res) => {
  try {
    const { stockId }           = req.params;
    const { limit = 50, offset = 0 } = req.query;

    if (!stockId) {
      return res.status(400).json({ success: false, message: 'Stock ID is required' });
    }

    const result = await stockServices.getStockMovements(stockId, parseInt(limit), parseInt(offset));

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Stocks] getStockMovements:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * GET /stocks/movements/equipment/:equipmentId
 * Returns all stock movements for a specific equipment.
 */
const getStockMovementsByEquipment = async (req, res) => {
  try {
    const { equipmentId } = req.params;

    if (!equipmentId) {
      return res.status(400).json({ success: false, message: 'Equipment ID is required' });
    }

    const result = await stockServices.getStockMovementsByEquipment(equipmentId);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Stocks] getStockMovementsByEquipment:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * GET /stocks/movements/mechanic/:mechanicId
 * Returns all stock movements attributed to a specific mechanic.
 */
const getStockMovementsByMechanic = async (req, res) => {
  try {
    const { mechanicId } = req.params;

    if (!mechanicId) {
      return res.status(400).json({ success: false, message: 'Mechanic ID is required' });
    }

    const result = await stockServices.getStockMovementsByMechanic(mechanicId);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Stocks] getStockMovementsByMechanic:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * GET /stocks/accountability
 * Returns a stock accountability report for a date range. Query params: startDate, endDate.
 */
const getStockAccountabilityReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'startDate and endDate are required' });
    }

    const result = await stockServices.getStockAccountabilityReport(startDate, endDate);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Stocks] getStockAccountabilityReport:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * GET /stocks/barcode/:objectId
 * Looks up a stock record by barcode object ID.
 */
const scanStockByBarcode = async (req, res) => {
  try {
    const { objectId } = req.params;

    if (!objectId) {
      return res.status(400).json({ success: false, message: 'Barcode data is required' });
    }

    const result = await stockServices.scanStockByBarcode(objectId);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Stocks] scanStockByBarcode:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Stock CRUD
  addStocks,
  getStocks,
  getStocksByType,
  getStocksByEquipment,
  getStockById,
  updateProduct,
  updateStock,
  deleteStock,
  // Quantity
  addStockQuantity,
  deductStockQuantity,
  adjustStockQuantity,
  // Movements & Tracking
  getMovementsWithStock,
  getStockMovements,
  getStockMovementsByEquipment,
  getStockMovementsByMechanic,
  getStockAccountabilityReport,
  scanStockByBarcode,
};