import express from 'express';
import chatController from '../controllers/chatController.js';
import authMiddleware from '../middlewares/authMiddleware.js';

const router = express.Router();

// All chat routes require authentication
router.use(authMiddleware);

/**
 * Session Management Routes
 */

// Create a new chat session
router.post('/sessions', chatController.createSession);

// Get all sessions for the authenticated learner
router.get('/sessions', chatController.getSessions);

// Delete all chat sessions for the authenticated learner
router.delete('/sessions', chatController.deleteAllSessions);

// Get a specific session by ID
router.get('/sessions/:sessionId', chatController.getSession);

// Update session (e.g., change title)
router.patch('/sessions/:sessionId', chatController.updateSession);

// Delete a specific chat session
router.delete('/sessions/:sessionId', chatController.deleteSession);

// End a chat session (mark as inactive)
router.post('/sessions/:sessionId/end', chatController.endSession);

/**
 * Message Routes
 */

// Send a message in a chat session
router.post('/sessions/:sessionId/messages', chatController.sendMessage);

// Get chat history for a session
router.get('/sessions/:sessionId/messages', chatController.getMessages);

export default router;
