const express = require('express');
const router  = express.Router();

const controller                                     = require('../controllers/stock.controller');

// ─────────────────────────────────────────────────────────────────────────────
// Stock Routes
// ─────────────────────────────────────────────────────────────────────────────

// ── CRUD ──────────────────────────────────────────────────────────────────────
router.get   ('/get-all-stocks',                    controller.getStocks);
router.get   ('/get-stock/:stockId',                controller.getStockById);
router.get   ('/get-stocks-by-type/:type',          controller.getStocksByType);
router.get   ('/get-stocks-by-equipment/:equipmentNumber', controller.getStocksByEquipment);
router.post  ('/add-stocks',                        controller.addStocks);
router.put   ('/update-stock/:stockId',             controller.updateProduct);
router.put   ('/update-quantity/:stockId',          controller.updateStock);
router.delete('/delete-stock/:id',                  controller.deleteStock);

// ── Quantity management ───────────────────────────────────────────────────────
router.post('/add-quantity/:stockId',      controller.addStockQuantity);
router.post('/deduct-quantity/:stockId',   controller.deductStockQuantity);
router.post('/adjust-quantity/:stockId',   controller.adjustStockQuantity);

// ── Movements ─────────────────────────────────────────────────────────────────
router.get('/movements',                          controller.getMovementsWithStock);
router.get('/movements/stock/:stockId',           controller.getStockMovements);
router.get('/movements/equipment/:equipmentId',   controller.getStockMovementsByEquipment);
router.get('/movements/mechanic/:mechanicId',     controller.getStockMovementsByMechanic);

// ── Reports & scan ────────────────────────────────────────────────────────────
router.get('/reports/accountability', controller.getStockAccountabilityReport);
router.get('/scan/:objectId',         controller.scanStockByBarcode);

module.exports = router;