import express from 'express';
import preferencesController from '../controllers/preferencesController.js';
import authMiddleware from '../middlewares/authMiddleware.js';

const router = express.Router();

// All preferences routes require authentication
router.use(authMiddleware);

// Save learner preferences
router.post('/learner', preferencesController.savePreferences);

// Get learner preferences
router.get('/learner', preferencesController.getPreferences);

// Update learner preferences
router.put('/learner', preferencesController.updatePreferences);

// Delete learner preferences
router.delete('/learner', preferencesController.deletePreferences);

export default router;
