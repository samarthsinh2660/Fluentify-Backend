const express = require('express');
const router = express.Router();
const preferencesController = require('../controllers/preferencesController');
const authMiddleware = require('../middlewares/authMiddleware');

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

module.exports = router;
