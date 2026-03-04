const express = require('express');
const router  = express.Router();

const controller = require('../controllers/explorer.controller.js');

// ─────────────────────────────────────────────────────────────────────────────
// Explorer Routes
// ─────────────────────────────────────────────────────────────────────────────

// ── Releases ──────────────────────────────────────────────────────────────────
router.get   ('/get-all-releases',                              controller.getAllReleases);
router.get   ('/get-latest-release',                            controller.getLatestRelease);
router.get   ('/get-latest-release-for-user',                   controller.getLatestReleaseForUser);
router.post  ('/create-release',                                controller.createRelease);
router.delete('/releases/:id',                                  controller.deleteRelease);

// ── Features ──────────────────────────────────────────────────────────────────
router.post  ('/releases/:releaseId/add-feature',               controller.addFeature);
router.put   ('/releases/:releaseId/features/:featureId',       controller.updateFeature);
router.delete('/releases/:releaseId/features/:featureId',       controller.deleteFeature);
router.put   ('/releases/:releaseId/reorder-features',          controller.reorderFeatures);
router.post  ('/mark-feature-explored',                         controller.markFeatureAsExplored);

module.exports = router;