const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleWare } = require('../utils/utils');

router.post('/login', authController.loginUser);
router.post('/logout', authController.logoutUser);

module.exports = router;
