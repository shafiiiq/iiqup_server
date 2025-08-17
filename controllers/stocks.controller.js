const stockServices = require('../services/stocks-services.js');
const { putObject } = require('../s3bucket/s3.bucket');
const path = require('path');

const addEquipmentStocks = async (req, res) => {
  try {
    const result = await stockServices.insertEquipmentStocks(req.body);
    res.status(result.status).json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
};

const addEquipmentImage = async (req, res) => {
  try {
    const { equipmentNo, files } = req.body;

    if (!equipmentNo) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: 'Equipment ID is required'
      });
    }

    if (!files || !files.length) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: 'At least one file is required'
      });
    }

    // Generate presigned URLs for each file
    const filesWithUploadData = await Promise.all(
      files.map(async (file) => {
        // Get the label for this specific file, or use default
        const imageLabel = file.label || 'Unlabeled';
        
        const ext = path.extname(file.fileName);
        const finalFilename = `${equipmentNo}-${Date.now()}${ext}`;
        const s3Key = `equipment-images/${equipmentNo}/${finalFilename}`;

        const uploadUrl = await putObject(
          file.fileName,
          s3Key,
          file.mimeType
        );

        // Save to database immediately after getting presigned URL
        // Use the specific file's label
        const saveResult = await stockServices.addEquipmentImage(
          equipmentNo,
          s3Key,
          imageLabel, // Use the individual file's label
          finalFilename,
          file.mimeType
        );

        if (!saveResult.success) {
          throw new Error(`Failed to save image metadata: ${saveResult.message}`);
        }

        return {
          fileName: finalFilename,
          originalName: file.fileName,
          filePath: s3Key,
          mimeType: file.mimeType,
          type: file.mimeType.startsWith('video/') ? 'video' : 'photo',
          uploadUrl: uploadUrl,
          uploadDate: new Date(),
          label: imageLabel, // Include the label in the response
          dbSaveResult: saveResult
        };
      })
    );

    res.status(200).json({
      status: 200,
      message: 'Pre-signed URLs generated and metadata saved',
      data: {
        uploadData: filesWithUploadData
      }
    });

  } catch (err) {
    res.status(err.status || 500).json({
      status: err.status || 500,
      success: false,
      message: err.message || 'Internal server error'
    });
  }
};

const getEquipmentRegNo = async (req, res) => {
  try {
    const regNo = req.params.regNo;

    if (!regNo) {
      return res.status(400).json({
        success: false,
        message: 'Equipment regNo is required'
      });
    }

    const result = await stockServices.getEquipmentRegNo(regNo);
    res.status(result.status).json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
};

const addStocks = async (req, res) => {
  try {
    const result = await stockServices.insertStocks(req.body);
    res.status(result.status).json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
};

// Get all stocks
const getStocks = async (req, res) => {
  try {
    const result = await stockServices.fetchStocks();
    res.status(result.status).json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
};

// Get stocks by type (optional additional endpoint)
const getStocksByType = async (req, res) => {
  try {
    const { type } = req.params;
    const result = await stockServices.fetchStocksByType(type);
    res.status(result.status).json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
};

// Get stocks by equipment number (optional additional endpoint)
const getStocksByEquipment = async (req, res) => {
  try {
    const { equipmentNumber } = req.params;
    const result = await stockServices.fetchStocksByEquipment(equipmentNumber);
    res.status(result.status).json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
};

const updateProduct = async (req, res) => {
  try {
    const { stockId } = req.params;

    const result = await stockServices.updateProduct(stockId, req.body);
    res.status(result.status).json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
};

// Update stock by ID with movement tracking
const updateStock = async (req, res) => {
  try {
    const { stockId } = req.params;

    // Validate required fields for movement tracking
    if (req.body.type && req.body.type === 'deduct') {
      const requiredFields = ['equipmentName', 'mechanicName'];
      const missingFields = requiredFields.filter(field => !req.body[field]);

      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Missing required fields for deduction: ${missingFields.join(', ')}`
        });
      }
    }

    const result = await stockServices.updateStock(stockId, req.body);
    res.status(result.status).json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
};

// Delete stock by ID (optional additional endpoint)
const deleteStock = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await stockServices.deleteStock(id);
    res.status(result.status).json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
};

// NEW TRACKING CONTROLLERS

// Get all movements with stock information
const getMovementsWithStock = async (req, res) => {
  try {
    const filters = {
      equipmentId: req.query.equipmentId,
      mechanicId: req.query.mechanicId,
      type: req.query.type,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined) {
        delete filters[key];
      }
    });

    const result = await stockServices.getMovementsWithStock(filters);

    res.status(result.status).json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
};

// Get stock movements by equipment
const getStockMovementsByEquipment = async (req, res) => {
  try {
    const { equipmentId } = req.params;

    if (!equipmentId) {
      return res.status(400).json({
        success: false,
        message: 'Equipment ID is required'
      });
    }

    const result = await stockServices.getStockMovementsByEquipment(equipmentId);
    res.status(result.status).json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
};

// Get stock movements by mechanic
const getStockMovementsByMechanic = async (req, res) => {
  try {
    const { mechanicId } = req.params;

    if (!mechanicId) {
      return res.status(400).json({
        success: false,
        message: 'Mechanic ID is required'
      });
    }

    const result = await stockServices.getStockMovementsByMechanic(mechanicId);
    res.status(result.status).json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
};

// Get stock accountability report
const getStockAccountabilityReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const result = await stockServices.getStockAccountabilityReport(startDate, endDate);

    res.status(result.status).json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
};

// Add stock quantity (with movement tracking)
const addStockQuantity = async (req, res) => {
  try {
    const { stockId } = req.params;
    const { quantity, reason, notes, createdBy } = req.body;

    if (!quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid quantity is required'
      });
    }

    // Get current stock to calculate new quantity
    const currentStock = await stockServices.getStockById(stockId);
    if (!currentStock.success) {
      return res.status(currentStock.status).json(currentStock);
    }

    const updateData = {
      type: 'add',
      stockCount: currentStock.data.stockCount + quantity,
      reason: reason || 'Stock addition',
      notes: notes || '',
      createdBy: createdBy || 'System'
    };

    const result = await stockServices.updateStock(stockId, updateData);
    res.status(result.status).json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
};

// Deduct stock quantity (with movement tracking)
const deductStockQuantity = async (req, res) => {
  try {
    const { stockId } = req.params;
    const {
      quantity,
      equipmentId,
      mechanicId,
      equipmentName,
      mechanicName,
      equipmentNumber,
      reason,
      notes,
      createdBy
    } = req.body;

    // Validate required fields
    if (!quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid quantity is required'
      });
    }

    if (!equipmentId || !mechanicId || !equipmentName || !mechanicName) {
      return res.status(400).json({
        success: false,
        message: 'Equipment ID, Mechanic ID, Equipment Name, and Mechanic Name are required'
      });
    }

    // Get current stock to calculate new quantity and validate availability
    const currentStock = await stockServices.getStockById(stockId);
    if (!currentStock.success) {
      return res.status(currentStock.status).json(currentStock);
    }

    if (currentStock.data.stockCount < quantity) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient stock quantity'
      });
    }

    const updateData = {
      type: 'deduct',
      stockCount: currentStock.data.stockCount - quantity,
      equipmentId,
      mechanicId,
      equipmentName,
      mechanicName,
      equipmentNumber: equipmentNumber || '',
      reason: reason || 'Stock deduction',
      notes: notes || '',
      createdBy: createdBy || 'System'
    };

    const result = await stockServices.updateStock(stockId, updateData);
    res.status(result.status).json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
};

// Adjust stock quantity (with movement tracking)
const adjustStockQuantity = async (req, res) => {
  try {
    const { stockId } = req.params;
    const { newQuantity, reason, notes, createdBy } = req.body;

    if (newQuantity === undefined || newQuantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid new quantity is required'
      });
    }

    const updateData = {
      type: 'adjustment',
      stockCount: newQuantity,
      reason: reason || 'Stock adjustment',
      notes: notes || '',
      createdBy: createdBy || 'System'
    };

    const result = await stockServices.updateStock(stockId, updateData);
    res.status(result.status).json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
};

// Get stock by ID
const getStockById = async (req, res) => {
  try {
    const { stockId } = req.params;
    const result = await stockServices.getStockById(stockId);
    res.status(result.status).json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
};

// Get stock movements for a specific stock item
const getStockMovements = async (req, res) => {
  try {
    const { stockId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const result = await stockServices.getStockMovements(stockId, parseInt(limit), parseInt(offset));
    res.status(result.status).json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
};

module.exports = {
  // Original controllers
  addEquipmentStocks,
  addEquipmentImage,
  getEquipmentRegNo,
  addStocks,
  getStocks,
  getStocksByType,
  getStocksByEquipment,
  updateStock,
  deleteStock,

  // New tracking controllers
  getMovementsWithStock,
  getStockMovementsByEquipment,
  getStockMovementsByMechanic,
  getStockAccountabilityReport,
  addStockQuantity,
  deductStockQuantity,
  adjustStockQuantity,
  getStockById,
  getStockMovements,

  updateProduct
};