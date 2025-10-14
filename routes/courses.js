const express = require('express');
const router = express.Router();
const courseController = require('../controllers/courseController');
const authMiddleware = require('../middlewares/authMiddleware');

// All course routes require authentication
router.use(authMiddleware);

// Generate a new course
router.post('/generate', courseController.generateCourse);

// Get learner's courses
router.get('/', courseController.getLearnerCourses);

// Get specific course details with progress
router.get('/:courseId', courseController.getCourseDetails);

// Get specific lesson details (with unit ID)
router.get('/:courseId/units/:unitId/lessons/:lessonId', courseController.getLessonDetails);

// Get specific lesson details (backward compatible - without unit ID)
router.get('/:courseId/lessons/:lessonId', courseController.getLessonDetailsLegacy);

// Mark lesson as complete (backward compatible - without unit ID in URL)
router.post('/:courseId/lessons/:lessonId/complete', courseController.completeLessonLegacy);

module.exports = router;
