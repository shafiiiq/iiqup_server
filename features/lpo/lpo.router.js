const express = require('express');
const router = express.Router();
const multer = require('multer');
const controller = require('./lpo.controller');
const paginationMiddleware = require('../../shared/pagination/pagination.middleware');
const upload = multer({ storage: multer.memoryStorage() });

router.get('/get-all-lpo', paginationMiddleware, controller.getAllLPOs);
router.get('/get-lpo-by-ref/:refNo(*)', controller.getLPOByRef);
router.get('/get-company-details', controller.getCompanyDetails);
router.get('/check-latest-lpo-ref', controller.getLatestLPORef);
router.get('/check-latest-lpo', controller.getLatestLPO);
router.get('/get-lpos-by-date', controller.getLPOsByDateRange);
router.get('/get-lpos-by-company/:vendorName', controller.getLPOsByCompany);
router.get('/get-lpo-by-regno/:regNo', controller.getLposByRegNo);
router.get('/get-lpo-of-stock', controller.getLposForStock);
router.get('/get-lpo-of-all-equipments', controller.getLposForAllEquipments);
router.post('/add-lpo', controller.addLPO);
router.post('/upload-lpo', controller.uploadLPO);
router.post('/get-quotation-upload-url', controller.getQuotationUploadUrl);
router.put('/update-lpo/:refNo(*)', controller.updateLPO);
router.delete('/delete-lpo/:refNo', controller.deleteLPO);
router.post('/sign/:lpoRef(*)', controller.signLPO);
router.post('/pending-signatures', controller.getPendingSignatures);
router.post('/signed-by-user', controller.getSignedByUser);
router.post('/send-via-email', upload.fields([{ name: 'pdf', maxCount: 1 }, { name: 'attachments', maxCount: 10 }]), controller.sendLpoViaEmail);
router.put('/update-vendor-email/:vendorCode', controller.updateVendorEmail);

module.exports = router;
