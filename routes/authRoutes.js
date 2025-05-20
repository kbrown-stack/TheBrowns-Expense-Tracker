const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const {ensureAuthenticated} = require('../middlewares/auth');


// This is for the Authentication views and error handling.

router.get('/login', authController.getLogin);
router.post('/login', authController.postLogin);

router.get('/register', authController.getRegister);
router.post('/register', authController.postRegister);

// The Logout session

router.post('/logout', authController.logout);

//The user Profile

router.get('/profile', ensureAuthenticated,authController.getProfile);
router.post('/profile', ensureAuthenticated, authController.updateProfile);
router.post('/chnage-password', ensureAuthenticated, authController.changePassword);

//Then Export Module

module.exports = router;