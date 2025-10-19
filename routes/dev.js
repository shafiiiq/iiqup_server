const express = require('express');
const router = express.Router();
const devController = require('../controllers/dev.controller');

router.post('/add-portfolio', devController.uploadImage);
router.get('/get-porfolio/:id', devController.getPortfolioDetails);
router.get('/get-all-porfolio', devController.getAllPortfolio);

// Experience routes
router.get('/get-experiences', devController.getExperience);
router.post('/add-experiences', devController.addExperience);
router.put('/update-experiences/:id', devController.updateExperience);
router.delete('/delete-experiences/:id', devController.deleteExperience);

// Projects routes
router.get('/get-projects', devController.getProjects);
router.post('/add-projects', devController.addProject);
router.put('/update-projects/:id', devController.updateProject);
router.delete('/delete-projects/:id', devController.deleteProject);

// Skills routesa
router.get('/get-skills', devController.getSkills);
router.post('/add-skills', devController.addSkill);
router.put('/update-skills/:id', devController.updateSkill);
router.delete('/delete-skills/:id', devController.deleteSkill);

// Education routes
router.get('/get-educations', devController.getEducation);
router.post('/add-educations', devController.addEducation);
router.put('/update-educations/:id', devController.updateEducation);
router.delete('/delete-educations/:id', devController.deleteEducation);

// Certificates routes
router.get('/get-certificates', devController.getCertificates);
router.post('/add-certificates', devController.addCertificate);
router.put('/update-certificates/:id', devController.updateCertificate);
router.delete('/delete-certificates/:id', devController.deleteCertificate);

// Services routes
router.get('/get-services', devController.getServices);
router.post('/add-services', devController.addService);
router.put('/update-services/:id', devController.updateService);
router.delete('/delete-services/:id', devController.deleteService);

// Stats routes
router.get('/get-stats', devController.getStats);
router.put('/update-stats', devController.updateStats);

// Contact routes
router.get('/get-contact', devController.getContact);
router.put('/update-contact', devController.updateContact);

// Profile routes
router.get('/get-profile', devController.getProfile);
router.put('/update-profile', devController.updateProfile);

// get sense creads
router.post('/dev0auth-creads-access', devController.creadsAccess)

module.exports = router;