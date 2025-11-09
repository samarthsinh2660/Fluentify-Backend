import express from 'express';
import userManagementController from '../controllers/userManagementController.js';
import authMiddleware from '../middlewares/authMiddleware.js';

const router = express.Router();

// All user management routes require admin authentication
router.use(authMiddleware);

// Middleware to check if user is admin
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    const error = new Error('Admin access required');
    error.statusCode = 403;
    error.code = 20009;
    return next(error);
  }
  next();
};

router.use(adminOnly);

// Get all learners with pagination and search
router.get('/learners', userManagementController.getAllLearners);

// Get specific learner details
router.get('/learners/:learnerId', userManagementController.getLearnerById);

// Update learner details (name, email)
router.put('/learners/:learnerId', userManagementController.updateLearner);

// Update learner password
router.put('/learners/:learnerId/password', userManagementController.updateLearnerPassword);

// Delete learner
router.delete('/learners/:learnerId', userManagementController.deleteLearner);

// Get learner's courses
router.get('/learners/:learnerId/courses', userManagementController.getLearnerCourses);

export default router;
