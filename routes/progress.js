const express = require('express');
const router = express.Router();
const progressController = require('../controllers/progressController');
const authMiddleware = require('../middlewares/authMiddleware');

// Get user's all courses
router.get('/courses', authMiddleware, progressController.getUserCourses);

// Get course progress with units and lessons
router.get('/courses/:courseId', authMiddleware, progressController.getCourseProgress);

// Mark lesson as complete
router.post('/courses/:courseId/units/:unitId/lessons/:lessonId/complete', 
  authMiddleware, 
  progressController.markLessonComplete
);

module.exports = router;
