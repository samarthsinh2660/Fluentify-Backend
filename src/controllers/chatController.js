import chatRepository from '../repositories/chatRepository.js';
import chatService from '../services/chatService.js';
import { createdResponse, listResponse, successResponse, deletedResponse } from '../utils/response.js';
import { ERRORS } from '../utils/error.js';

class ChatController {
  /**
   * Create a new chat session
   * POST /api/chat/sessions
   */
  async createSession(req, res, next) {
    try {
      const { id, role } = req.user;
      const { language, title } = req.body;

      // Check if user is learner
      if (role !== 'learner') {
        throw ERRORS.LEARNER_ONLY_ROUTE;
      }

      // Create new session
      const session = await chatRepository.createSession(
        id,
        language || null,
        title || 'New Chat'
      );

      res.status(201).json(createdResponse({
        session: {
          id: session.id,
          sessionToken: session.session_token,
          language: session.language,
          title: session.session_title,
          startedAt: session.started_at,
          isActive: session.is_active
        }
      }, 'Chat session created successfully'));
    } catch (error) {
      console.error('Error creating chat session:', error);
      next(error);
    }
  }

  /**
   * Get all sessions for the authenticated learner
   * GET /api/chat/sessions
   */
  async getSessions(req, res, next) {
    try {
      const { id, role } = req.user;
      const { active_only } = req.query;

      // Check if user is learner
      if (role !== 'learner') {
        throw ERRORS.LEARNER_ONLY_ROUTE;
      }

      const activeOnly = active_only === 'true';
      const sessions = await chatRepository.findSessionsByLearnerId(id, activeOnly);

      res.json(listResponse(
        sessions.map(session => ({
          id: session.id,
          sessionToken: session.session_token,
          language: session.language,
          title: session.session_title,
          startedAt: session.started_at,
          endedAt: session.ended_at,
          isActive: session.is_active,
          messageCount: parseInt(session.message_count) || parseInt(session.total_messages) || 0,
          lastMessageAt: session.last_message_at
        })),
        'Chat sessions retrieved successfully',
        { count: sessions.length }
      ));
    } catch (error) {
      console.error('Error fetching chat sessions:', error);
      next(error);
    }
  }

  /**
   * Get a specific session by ID
   * GET /api/chat/sessions/:sessionId
   */
  async getSession(req, res, next) {
    try {
      const { id, role } = req.user;
      const { sessionId } = req.params;

      // Check if user is learner
      if (role !== 'learner') {
        throw ERRORS.LEARNER_ONLY_ROUTE;
      }

      // Find session
      const session = await chatRepository.findSessionById(sessionId);
      
      if (!session) {
        throw ERRORS.CHAT_SESSION_NOT_FOUND;
      }

      // Check if session belongs to learner
      if (session.learner_id !== id) {
        throw ERRORS.CHAT_UNAUTHORIZED_ACCESS;
      }

      res.json(successResponse({
        session: {
          id: session.id,
          sessionToken: session.session_token,
          language: session.language,
          title: session.session_title,
          startedAt: session.started_at,
          endedAt: session.ended_at,
          isActive: session.is_active,
          messageCount: session.message_count
        }
      }, 'Session retrieved successfully'));
    } catch (error) {
      console.error('Error fetching session:', error);
      next(error);
    }
  }

  /**
   * Send a message in a chat session
   * POST /api/chat/sessions/:sessionId/messages
   */
  async sendMessage(req, res, next) {
    try {
      const { id, role } = req.user;
      const { sessionId } = req.params;
      const { message } = req.body;

      // Check if user is learner
      if (role !== 'learner') {
        throw ERRORS.LEARNER_ONLY_ROUTE;
      }

      // Validate message
      const validation = chatService.validateMessage(message);
      if (!validation.valid) {
        throw ERRORS.CHAT_MESSAGE_REQUIRED;
      }

      // Find session
      const session = await chatRepository.findSessionById(sessionId);
      
      if (!session) {
        throw ERRORS.CHAT_SESSION_NOT_FOUND;
      }

      // Check if session belongs to learner
      if (session.learner_id !== id) {
        throw ERRORS.CHAT_UNAUTHORIZED_ACCESS;
      }

      // Check if session is active
      if (!session.is_active) {
        throw ERRORS.CHAT_SESSION_INACTIVE;
      }

      // Save user message
      const userMessage = await chatRepository.createMessage(
        sessionId,
        'learner',
        validation.message
      );

      // Update session title if this is the first message
      if (session.message_count === 0) {
        const sessionTitle = await chatService.generateSessionTitle(validation.message);
        await chatRepository.updateSessionTitle(sessionId, sessionTitle);
      }

      // Get conversation history for context
      const recentMessages = await chatRepository.getRecentMessages(sessionId, 10);

      // Get learner context
      const learnerContext = await chatService.getLearnerContext(id, session.language);

      // Generate AI response
      let aiResponseText;
      try {
        aiResponseText = await chatService.generateResponse(
          validation.message,
          recentMessages,
          learnerContext
        );
      } catch (aiError) {
        console.error('AI response error:', aiError);
        throw ERRORS.CHAT_AI_RESPONSE_FAILED;
      }

      // Save AI response
      const aiMessage = await chatRepository.createMessage(
        sessionId,
        'ai',
        aiResponseText
      );

      res.status(201).json(createdResponse({
        userMessage: {
          id: userMessage.id,
          sender: userMessage.sender,
          message: userMessage.message,
          createdAt: userMessage.created_at
        },
        aiMessage: {
          id: aiMessage.id,
          sender: aiMessage.sender,
          message: aiMessage.message,
          createdAt: aiMessage.created_at
        }
      }, 'Message sent successfully'));
    } catch (error) {
      console.error('Error sending message:', error);
      next(error);
    }
  }

  /**
   * Get chat history for a session
   * GET /api/chat/sessions/:sessionId/messages
   */
  async getMessages(req, res, next) {
    try {
      const { id, role } = req.user;
      const { sessionId } = req.params;
      const { limit = 100, offset = 0 } = req.query;

      // Check if user is learner
      if (role !== 'learner') {
        throw ERRORS.LEARNER_ONLY_ROUTE;
      }

      // Find session
      const session = await chatRepository.findSessionById(sessionId);
      
      if (!session) {
        throw ERRORS.CHAT_SESSION_NOT_FOUND;
      }

      // Check if session belongs to learner
      if (session.learner_id !== id) {
        throw ERRORS.CHAT_UNAUTHORIZED_ACCESS;
      }

      // Get messages
      const messages = await chatRepository.getMessagesBySessionId(
        sessionId,
        parseInt(limit),
        parseInt(offset)
      );

      const totalCount = await chatRepository.getMessageCount(sessionId);

      res.json(listResponse(
        messages.map(msg => ({
          id: msg.id,
          sender: msg.sender,
          message: msg.message,
          createdAt: msg.created_at
        })),
        'Chat history retrieved successfully',
        {
          count: messages.length,
          totalCount,
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      ));
    } catch (error) {
      console.error('Error fetching messages:', error);
      next(error);
    }
  }

  /**
   * Update session title
   * PATCH /api/chat/sessions/:sessionId
   */
  async updateSession(req, res, next) {
    try {
      const { id, role } = req.user;
      const { sessionId } = req.params;
      const { title } = req.body;

      // Check if user is learner
      if (role !== 'learner') {
        throw ERRORS.LEARNER_ONLY_ROUTE;
      }

      if (!title || title.trim().length === 0) {
        throw ERRORS.MISSING_REQUIRED_FIELDS;
      }

      // Find session
      const session = await chatRepository.findSessionById(sessionId);
      
      if (!session) {
        throw ERRORS.CHAT_SESSION_NOT_FOUND;
      }

      // Check if session belongs to learner
      if (session.learner_id !== id) {
        throw ERRORS.CHAT_UNAUTHORIZED_ACCESS;
      }

      // Update title
      const updatedSession = await chatRepository.updateSessionTitle(sessionId, title.trim());

      res.json(successResponse({
        session: {
          id: updatedSession.id,
          title: updatedSession.session_title
        }
      }, 'Session updated successfully'));
    } catch (error) {
      console.error('Error updating session:', error);
      next(error);
    }
  }

  /**
   * Delete a chat session
   * DELETE /api/chat/sessions/:sessionId
   */
  async deleteSession(req, res, next) {
    try {
      const { id, role } = req.user;
      const { sessionId } = req.params;

      // Check if user is learner
      if (role !== 'learner') {
        throw ERRORS.LEARNER_ONLY_ROUTE;
      }

      // Find session
      const session = await chatRepository.findSessionById(sessionId);
      
      if (!session) {
        throw ERRORS.CHAT_SESSION_NOT_FOUND;
      }

      // Check if session belongs to learner
      if (session.learner_id !== id) {
        throw ERRORS.CHAT_UNAUTHORIZED_ACCESS;
      }

      // Delete session (cascade will delete messages)
      await chatRepository.deleteSession(sessionId);

      res.json(deletedResponse('Chat session deleted successfully'));
    } catch (error) {
      console.error('Error deleting session:', error);
      next(error);
    }
  }

  /**
   * Delete all chat sessions for the authenticated learner
   * DELETE /api/chat/sessions
   */
  async deleteAllSessions(req, res, next) {
    try {
      const { id, role } = req.user;

      // Check if user is learner
      if (role !== 'learner') {
        throw ERRORS.LEARNER_ONLY_ROUTE;
      }

      // Delete all sessions
      await chatRepository.deleteAllSessionsByLearnerId(id);

      res.json(deletedResponse('All chat sessions deleted successfully'));
    } catch (error) {
      console.error('Error deleting all sessions:', error);
      next(error);
    }
  }

  /**
   * End a chat session (mark as inactive)
   * POST /api/chat/sessions/:sessionId/end
   */
  async endSession(req, res, next) {
    try {
      const { id, role } = req.user;
      const { sessionId } = req.params;

      // Check if user is learner
      if (role !== 'learner') {
        throw ERRORS.LEARNER_ONLY_ROUTE;
      }

      // Find session
      const session = await chatRepository.findSessionById(sessionId);
      
      if (!session) {
        throw ERRORS.CHAT_SESSION_NOT_FOUND;
      }

      // Check if session belongs to learner
      if (session.learner_id !== id) {
        throw ERRORS.CHAT_UNAUTHORIZED_ACCESS;
      }

      // End session
      await chatRepository.endSession(sessionId);

      res.json(successResponse(null, 'Chat session ended successfully'));
    } catch (error) {
      console.error('Error ending session:', error);
      next(error);
    }
  }
}

export default new ChatController();
