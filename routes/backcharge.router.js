const express = require('express');
const router  = express.Router();
const multer  = require('multer');

const controller = require('../controllers/backcharge.controller');

const upload = multer({ storage: multer.memoryStorage() }); 

// ─────────────────────────────────────────────────────────────────────────────
// Backcharge Routes
// ─────────────────────────────────────────────────────────────────────────────

// ── Records ───────────────────────────────────────────────────────────────────
router.get ('/get-backcharge-reports',               controller.getAllBackchargeReports);
router.get ('/get-backcharge/:id',                   controller.getBackchargeById);
router.get ('/get-backcharge-by-report/:reportNo',   controller.getBackchargeByReportNo);
router.get ('/get-backcharge-by-ref/:refNo',         controller.getBackchargeByRefNo);
router.get ('/check-latest-backcharge-ref',          controller.getLatestBackchargeRef);
router.post('/add-backcharge',                       controller.addBackcharge);
router.put ('/update-backcharge/:id',                controller.updateBackcharge);
router.delete('/delete-backcharge/:id',              controller.deleteBackcharge);

// ── Email ─────────────────────────────────────────────────────────────────────
router.post('/send-via-email', upload.single('pdf'), controller.sendBackchargeToEmail);
router.put ('/update-supplier-email/:supplierCode',  controller.updateSupplierEmail);

// ── Search ────────────────────────────────────────────────────────────────────
router.get('/equipment/search',                      controller.searchEquipmentByPlate);
router.get('/suppliers/search',                      controller.searchSuppliers);
router.get('/sites/search',                          controller.searchSites);

// ── Signing ───────────────────────────────────────────────────────────────────
router.post('/sign/:refNo(*)',                       controller.signBackcharge);
router.post('/pending-signatures',                    controller.getPendingSignatures);

module.exports = router;