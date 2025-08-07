const express = require('express');
const router = express.Router();
const lpoController = require('../controllers/lpo.controllers');

// Add new LPO
router.post('/add-lpo', lpoController.addLPO);

// Get all LPOs
router.get('/get-all-lpo', lpoController.getAllLPOs);

// Get LPO by reference number
router.get('/get-lpo-by-ref/:refNo(*)', lpoController.getLPOByRef);

// Get all company details
router.get('/get-company-details', lpoController.getCompanyDetails);

// Get latest LPO reference
router.get('/check-latest-lpo-ref', lpoController.getLatestLPORef);

// Get latest LPO
router.get('/check-latest-lpo', lpoController.getLatestLPO);

// Update LPO
router.put('/update-lpo/:refNo', lpoController.updateLPO);

// Delete LPO
router.delete('/delete-lpo/:refNo', lpoController.deleteLPO);

// Get LPOs by date range
router.get('/get-lpos-by-date', lpoController.getLPOsByDateRange);

// Get LPOs by company
router.get('/get-lpos-by-company/:vendorName', lpoController.getLPOsByCompany);

router.get('/get-lpo-by-regno/:regNo', lpoController.getLposByRegNo);
router.get('/get-lpo-of-stock', lpoController.getLposForStock);
router.get('/get-lpo-of-all-equipments', lpoController.getLposForAllEquipments);

module.exports = router;