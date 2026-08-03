const express = require('express');
const router = express.Router();
const multer = require('multer');

const controller = require('./quotation.controller');

const upload = multer({ storage: multer.memoryStorage() });

// ─────────────────────────────────────────────────────────────────────────────
// quotation Routes
// ─────────────────────────────────────────────────────────────────────────────

// ── Records ───────────────────────────────────────────────────────────────────
router.get('/get-all-quotation', controller.getAllquotations);
router.get('/get-quotation-by-ref/:refNo(*)', controller.getquotationByRef);
router.get('/get-company-details', controller.getCompanyDetails);
router.get('/check-latest-quotation-ref', controller.getLatestquotationRef);
router.get('/check-latest-quotation', controller.getLatestquotation);
router.get('/get-quotations-by-date', controller.getquotationsByDateRange);
router.get(
  '/get-quotations-by-company/:vendorName',
  controller.getquotationsByCompany
);
router.get('/get-quotation-by-regno/:regNo', controller.getquotationsByRegNo);
router.get('/get-quotation-of-stock', controller.getquotationsForStock);
router.get(
  '/get-quotation-of-all-equipments',
  controller.getquotationsForAllEquipments
);
router.post('/add-quotation', controller.addquotation);
router.post('/upload-quotation', controller.uploadquotation);
router.put('/update-quotation/:refNo(*)', controller.updatequotation);
router.delete('/delete-quotation/:refNo', controller.deletequotation);

// ── Signing   ───────────────────────────────────────────────────────────────────
router.post('/sign/:quotationRef(*)', controller.signquotation);
router.post('/pending-signatures', controller.getPendingSignatures);
router.post('/signed-by-user', controller.getSignedByUser);

// ── Email ─────────────────────────────────────────────────────────────────────
router.post(
  '/send-via-email',
  upload.fields([
    { name: 'pdf', maxCount: 1 },
    { name: 'attachments', maxCount: 10 },
  ]),
  controller.sendquotationViaEmail
);
router.put('/update-vendor-email/:vendorCode', controller.updateVendorEmail);

module.exports = router;
