const express = require('express');
const router = express.Router();

const controller = require('./toolkit.controller');
const paginationMiddleware = require('../../shared/pagination/pagination.middleware');

// ─────────────────────────────────────────────────────────────────────────────
// Toolkit Routes
// ─────────────────────────────────────────────────────────────────────────────

// ── CRUD ──────────────────────────────────────────────────────────────────────
router.get('/get-toolkits', paginationMiddleware, controller.getToolKits);
router.post('/add-toolkits', controller.addToolKits);
router.put('/update-toolkit/:id', controller.updatetoolKits);
router.delete('/delete-toolkit/:id', controller.deletetoolKits);

// ── Variants ──────────────────────────────────────────────────────────────────
router.put('/update-variant/:toolkitId/:variantId', controller.updateVariant);
router.delete(
  '/delete-variant/:toolkitId/:variantId',
  controller.deleteVariant
);

// ── Stock ─────────────────────────────────────────────────────────────────────
router.get('/stock-history/:toolkitId/:variantId', controller.getStockHistory);
router.get(
  '/toolkit-stock-history/:toolkitId',
  controller.getToolkitStockHistory
);
router.put('/reduce-stock/:toolkitId/:variantId', controller.reduceStock);

// ── Search & scan ─────────────────────────────────────────────────────────────
router.get('/search-toolkits', paginationMiddleware, controller.searchToolkits);
router.get('/scan/:objectId', controller.scanToolkitByBarcode);

module.exports = router;
