const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { ensureAuthenticated } = require('../middlewares/auth');

//The Dashboard Home Page.

router.get('/', ensureAuthenticated, dashboardController.getDashboard);

// To generate Report

router.post('/post', ensureAuthenticated, dashboardController.generateReport);

module.exports = router;
