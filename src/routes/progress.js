import express from 'express';
import { getCourseProgress, markLessonComplete, retryLesson, getUserCourses } from '../controllers/progressController.js';
import authMiddleware from '../middlewares/authMiddleware.js';

const router = express.Router();

// Get user's all courses
router.get('/courses', authMiddleware, getUserCourses);

// Get course progress with units and lessons
router.get('/courses/:courseId', authMiddleware, getCourseProgress);

// Mark lesson as complete (first time only)
router.post('/courses/:courseId/units/:unitId/lessons/:lessonId/complete',
  authMiddleware,
  markLessonComplete
);

// Retry a completed lesson — updates concept mastery score only, no XP re-award
router.post('/courses/:courseId/units/:unitId/lessons/:lessonId/retry',
  authMiddleware,
  retryLesson
);

export default router;
