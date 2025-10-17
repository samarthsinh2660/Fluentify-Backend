/**
 * Retell AI Controller
 * Handles creating Retell AI call sessions for pronunciation practice
 */

import axios from 'axios';
import { successResponse, createdResponse } from '../utils/response.js';
import { ERRORS } from '../utils/error.js';

/**
 * Create a Retell AI call and return access token
 * @route POST /api/retell/create-call
 */
export const createRetellCall = async (req, res, next) => {
  try {
    const { agentId } = req.body;
    const userId = req.user.id;

    console.log('📞 Creating Retell AI call...');

    // Validate agent ID
    if (!agentId) {
      throw ERRORS.RETELL_AGENT_ID_REQUIRED;
    }

    // Check if Retell API key is configured
    if (!process.env.RETELL_API_KEY) {
      console.error('❌ RETELL_API_KEY not configured in environment variables');
      throw ERRORS.RETELL_API_NOT_CONFIGURED;
    }

    // Call Retell API to create a web call
    const response = await axios.post(
      'https://api.retellai.com/v2/create-web-call',
      {
        agent_id: agentId,
        metadata: {
          user_id: userId,
          created_at: new Date().toISOString(),
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.RETELL_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Retell call created successfully');
  

    // Return the access token to frontend
    res.json(createdResponse({
      accessToken: response.data.access_token,
      callId: response.data.call_id,
      agentId: response.data.agent_id,
    }, 'Call session created successfully! You can now start your pronunciation practice.'));

  } catch (error) {
    console.error('❌ Error creating Retell call:', error.response?.data || error.message);
    
    // Handle Retell API specific errors
    if (error.response) {
      const status = error.response.status;
      const errorData = error.response.data;
      
      // Map Retell API errors to our error codes
      if (status === 401 || status === 403) {
        return next(ERRORS.RETELL_AUTHENTICATION_FAILED);
      } else if (status === 429) {
        return next(ERRORS.RETELL_RATE_LIMIT);
      } else if (status === 400 && errorData?.message?.includes('agent')) {
        return next(ERRORS.RETELL_INVALID_AGENT);
      } else {
        // Generic Retell API error
        const retellError = new Error(errorData?.message || ERRORS.RETELL_CALL_CREATION_FAILED.message);
        retellError.code = ERRORS.RETELL_API_ERROR.code;
        retellError.statusCode = status;
        return next(retellError);
      }
    }
    
    // Pass other errors (network, etc.) to global error handler
    next(error);
  }
};
