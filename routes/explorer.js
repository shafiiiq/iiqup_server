const express = require('express');
const router = express.Router();
const ExplorerController = require('../controllers/explorer.controller.js');

router.get('/get-all-releases', ExplorerController.getAllReleases);
router.get('/get-latest-release', ExplorerController.getLatestRelease); 
router.get('/get-latest-release-for-user', ExplorerController.getLatestReleaseForUser);
router.post('/mark-feature-explored', ExplorerController.markFeatureAsExplored);
router.post('/create-release', ExplorerController.createRelease);
router.post('/releases/:releaseId/add-feature', ExplorerController.addFeature);
router.put('/releases/:releaseId/features/:featureId', ExplorerController.updateFeature);
router.delete('/releases/:releaseId/features/:featureId', ExplorerController.deleteFeature);
router.delete('/releases/:id', ExplorerController.deleteRelease);
router.put('/releases/:releaseId/reorder-features', ExplorerController.reorderFeatures);

module.exports = router;