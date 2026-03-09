const express = require('express');
const router  = express.Router();
const multer  = require('multer');

const controller = require('../controllers/lpo.controllers');

const upload = multer({ storage: multer.memoryStorage() });

// ─────────────────────────────────────────────────────────────────────────────
// LPO Routes
// ─────────────────────────────────────────────────────────────────────────────

// ── Records ───────────────────────────────────────────────────────────────────
router.get   ('/get-all-lpo',                          controller.getAllLPOs);
router.get   ('/get-lpo-by-ref/:refNo(*)',             controller.getLPOByRef);
router.get   ('/get-company-details',                  controller.getCompanyDetails);
router.get   ('/check-latest-lpo-ref',                 controller.getLatestLPORef);
router.get   ('/check-latest-lpo',                     controller.getLatestLPO);
router.get   ('/get-lpos-by-date',                     controller.getLPOsByDateRange);
router.get   ('/get-lpos-by-company/:vendorName',      controller.getLPOsByCompany);
router.get   ('/get-lpo-by-regno/:regNo',              controller.getLposByRegNo);
router.get   ('/get-lpo-of-stock',                     controller.getLposForStock);
router.get   ('/get-lpo-of-all-equipments',            controller.getLposForAllEquipments);
router.post  ('/add-lpo',                              controller.addLPO);
router.post  ('/upload-lpo',                           controller.uploadLPO);
router.put   ('/update-lpo/:refNo(*)',                 controller.updateLPO);
router.delete('/delete-lpo/:refNo',                    controller.deleteLPO);

// ── Approval workflow ─────────────────────────────────────────────────────────
router.post  ('/purchase-approval/:lpoRef(*)',         controller.purchaseApproval);
router.post  ('/manager-approval/:lpoRef(*)',          controller.managerApproval);
router.post  ('/ceo-approval/:lpoRef(*)',              controller.ceoApproval);
router.post  ('/accounts-approval/:lpoRef(*)',         controller.accountsApproval);
router.post  ('/items-available/:lpoRef(*)',           controller.markItemsAvailable);

// ── Signing   ───────────────────────────────────────────────────────────────────
router.post  ('/sign/:lpoRef(*)',                       controller.signLPO);
router.post   ('/pending-signatures',                   controller.getPendingSignatures);

// ── Email ─────────────────────────────────────────────────────────────────────
router.post  ('/send-via-email', upload.single('pdf'), controller.sendLpoViaEmail);
router.put   ('/update-vendor-email/:vendorCode',      controller.updateVendorEmail);

module.exports = router;