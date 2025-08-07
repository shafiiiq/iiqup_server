var express = require('express');
var router = express.Router();
const toolKitsController = require('../controllers/toolkits.controller');

// Main toolkit routes
router.post('/add-toolkits', toolKitsController.addToolKits);
router.get('/get-toolkits', toolKitsController.getToolKits);
router.put('/update-toolkit/:id', toolKitsController.updatetoolKits);
router.delete('/delete-toolkit/:id', toolKitsController.deletetoolKits);

// Variant-specific routes
router.put('/update-variant/:toolkitId/:variantId', toolKitsController.updateVariant);
router.delete('/delete-variant/:toolkitId/:variantId', toolKitsController.deleteVariant);

// Stock management routes
router.put('/reduce-stock/:toolkitId/:variantId', toolKitsController.reduceStock);

// Stock history routes
router.get('/stock-history/:toolkitId/:variantId', toolKitsController.getStockHistory);
router.get('/toolkit-stock-history/:toolkitId', toolKitsController.getToolkitStockHistory);

// Search route
router.get('/search-toolkits', toolKitsController.searchToolkits);

module.exports = router;