/**
 * Retell AI Routes
 */

import express from 'express';
import { createRetellCall } from '../controllers/retellController.js';
import authMiddleware from '../middlewares/authMiddleware.js';

const router = express.Router();

// All Retell routes require authentication
router.use(authMiddleware);

// Create Retell call (protected route)
router.post('/create-call', createRetellCall);

export default router;
