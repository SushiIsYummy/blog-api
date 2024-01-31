const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Blog-related routes
router.post('/login', authController.loginUser);
router.post('/logout', authController.logoutUser);

module.exports = router;
