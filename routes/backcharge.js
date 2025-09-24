// routes/backcharge.js
const express = require('express');
const router = express.Router();
const backchargeController = require('../controllers/backcharge.controller');

// Get all backcharge reports
router.get('/get-backcharge-reports', backchargeController.getAllBackchargeReports);

// Get backcharge report by ID
router.get('/get-backcharge/:id', backchargeController.getBackchargeById);

// Get backcharge report by report number
router.get('/get-backcharge-by-report/:reportNo', backchargeController.getBackchargeByReportNo);

// Get backcharge report by ref number
router.get('/get-backcharge-by-ref/:refNo', backchargeController.getBackchargeByRefNo);

// Add new backcharge report
router.post('/add-backcharge', backchargeController.addBackcharge);

// Update backcharge report
router.put('/update-backcharge/:id', backchargeController.updateBackcharge);

// Delete backcharge report
router.delete('/delete-backcharge/:id', backchargeController.deleteBackcharge);

// Check latest backcharge report number
router.get('/check-latest-backcharge-ref', backchargeController.getLatestBackchargeRef);

// Search equipment by plate number
router.get('/equipment/search', backchargeController.searchEquipmentByPlate);

// Search suppliers
router.get('/suppliers/search', backchargeController.searchSuppliers);

// Search sites
router.get('/sites/search', backchargeController.searchSites);

// Get latest reference number (fix the existing endpoint)
router.get('/check-latest-backcharge-ref', backchargeController.getLatestBackchargeRef);

module.exports = router;