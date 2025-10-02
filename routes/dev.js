const express = require('express');
const router = express.Router();
const devController = require('../controllers/dev.controller');

router.post('/add-portfolio', devController.uploadImage);
router.get('/get-porfolio/:id', devController.getPortfolioDetails);
router.get('/get-all-porfolio', devController.getAllPortfolio);

module.exports = router;