// routes/report.routes.js
const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/report.controller.js');

// ── CRUD ──────────────────────────────────────────────────────────────────────
router.post  ('/add-service-report',     controller.addServiceReport);
router.get   ('/get-report/with-id/:id', controller.getServiceReportWithId);
router.put   ('/updatewith/:id',         controller.updateServiceReportWithId);
router.delete('/deletewith/:id',         controller.removeServiceReportWithId);

// ── Queries ───────────────────────────────────────────────────────────────────
router.get('/histories/:regNo/:type/:param1?/:param2?/:param3?', controller.handleHistory);
router.get('/summary/:type/:param1?/:param2?',                   controller.handleSummary);

// ── Wildcard (must stay last) ─────────────────────────────────────────────────
router.get('/:regNo/:date', controller.getServiceReport);

module.exports = router;