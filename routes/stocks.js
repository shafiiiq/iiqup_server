const express = require('express');
const router = express.Router();
const stocksController = require('../controllers/stocks.controller');
const { processEquipmentData, uploadEquipmentImages } = require('../multer/hand_over');

// ===== EQUIPMENT RELATED ROUTES =====
router.post('/add-handover-report', processEquipmentData, stocksController.addEquipmentStocks);
router.post('/add-equipment-image', uploadEquipmentImages, stocksController.addEquipmentImage);
router.get('/equipment/:regNo', stocksController.getEquipmentRegNo);

// ===== BASIC STOCK ROUTES =====
router.post('/add-stocks', stocksController.addStocks);
router.get('/get-all-stocks', stocksController.getStocks);
router.get('/get-stock/:stockId', stocksController.getStockById);
router.put('/update-stock/:stockId', stocksController.updateProduct);

// ===== STOCK FILTERING ROUTES =====
router.get('/get-stocks-by-type/:type', stocksController.getStocksByType);
router.get('/get-stocks-by-equipment/:equipmentNumber', stocksController.getStocksByEquipment);

// ===== STOCK UPDATE ROUTES =====
router.put('/update-quantity/:stockId', stocksController.updateStock);
router.delete('/delete-stock/:id', stocksController.deleteStock);

// ===== STOCK QUANTITY MANAGEMENT ROUTES =====
router.post('/add-quantity/:stockId', stocksController.addStockQuantity);
router.post('/deduct-quantity/:stockId', stocksController.deductStockQuantity);
router.post('/adjust-quantity/:stockId', stocksController.adjustStockQuantity);

// ===== STOCK MOVEMENT TRACKING ROUTES =====
router.get('/movements', stocksController.getMovementsWithStock);
router.get('/movements/stock/:stockId', stocksController.getStockMovements);
router.get('/movements/equipment/:equipmentId', stocksController.getStockMovementsByEquipment);
router.get('/movements/mechanic/:mechanicId', stocksController.getStockMovementsByMechanic);

// ===== REPORTING ROUTES =====
router.get('/reports/accountability', stocksController.getStockAccountabilityReport);

module.exports = router;