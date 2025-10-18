import express from 'express';
import contestController from '../controllers/contestController.js';
import authMiddleware, { adminMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// ================== ADMIN ROUTES ==================
// Protected with both auth and admin middleware

// Generate contest using AI
router.post('/generate', adminMiddleware, contestController.generateContest);

// Get all contests created by admin
router.get('/admin', adminMiddleware, contestController.getAdminContests);

// Create contest manually
router.post('/', adminMiddleware, contestController.createContest);

// Update contest
router.patch('/:contestId', adminMiddleware, contestController.updateContest);

// Delete contest
router.delete('/:contestId', adminMiddleware, contestController.deleteContest);

// Get contest statistics (admin only)
router.get('/:contestId/stats', adminMiddleware, contestController.getContestStats);

// ================== LEARNER ROUTES ==================
// Note: Some routes work for both admin and learner, placed after admin-specific routes

// Get published contests (learners)
router.get('/', contestController.getPublishedContests);

// Get contest details
router.get('/:contestId', contestController.getContestDetails);

// Submit contest answers (learner only)
router.post('/:contestId/submit', contestController.submitContest);

// Get contest leaderboard (anyone authenticated)
router.get('/:contestId/leaderboard', contestController.getLeaderboard);

// Get user's submission (learner only)
router.get('/:contestId/my-submission', contestController.getMySubmission);

export default router;
