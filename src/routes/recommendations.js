import express from 'express';
import recommendationController from '../controllers/recommendationController.js';
import authMiddleware from '../middlewares/authMiddleware.js';

const router = express.Router();

// All recommendation routes require authentication
router.use(authMiddleware);

// Get A* recommendations for a course (learner only)
router.get('/:courseId', (req, res, next) => recommendationController.getRecommendations(req, res, next));

// Get concept mastery profile for a course (learner only)
router.get('/:courseId/mastery', (req, res, next) => recommendationController.getMasteryProfile(req, res, next));

// Get full knowledge graph with mastery overlay
// Learner: own graph | Admin: any learner via ?learnerId=X
router.get('/:courseId/graph', (req, res, next) => recommendationController.getKnowledgeGraph(req, res, next));

// Mark a recommendation as followed (learner only)
router.post('/:courseId/follow', (req, res, next) => recommendationController.markFollowed(req, res, next));

// Force rebuild concept graph for a course (delete old nodes/edges + re-extract)
router.post('/:courseId/rebuild-graph', (req, res, next) => recommendationController.rebuildGraph(req, res, next));

export default router;
