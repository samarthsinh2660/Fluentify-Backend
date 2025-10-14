import express from 'express';
import { getCourseProgress, markLessonComplete, getUserCourses } from '../controllers/progressController.js';
import authMiddleware from '../middlewares/authMiddleware.js';

const router = express.Router();

// Get user's all courses
router.get('/courses', authMiddleware, getUserCourses);

// Get course progress with units and lessons
router.get('/courses/:courseId', authMiddleware, getCourseProgress);

// Mark lesson as complete
router.post('/courses/:courseId/units/:unitId/lessons/:lessonId/complete',
  authMiddleware,
  markLessonComplete
);

export default router;
