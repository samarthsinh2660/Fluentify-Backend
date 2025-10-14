import express from 'express';
import authController from '../controllers/authController.js';
import authMiddleware from '../middlewares/authMiddleware.js';

const router = express.Router();

// Signup routes
router.post('/signup/learner', authController.signupLearner);
router.post('/signup/admin', authController.signupAdmin);

// Login routes
router.post('/login/learner', authController.loginLearner);
router.post('/login/admin', authController.loginAdmin);

// Protected profile route
router.get('/profile', authMiddleware, authController.getProfile);

export default router;
