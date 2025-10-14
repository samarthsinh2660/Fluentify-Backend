const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');

// Signup routes
router.post('/signup/learner', authController.signupLearner);
router.post('/signup/admin', authController.signupAdmin);

// Login routes
router.post('/login/learner', authController.loginLearner);
router.post('/login/admin', authController.loginAdmin);

// Protected profile route
router.get('/profile', authMiddleware, authController.getProfile);

module.exports = router;
