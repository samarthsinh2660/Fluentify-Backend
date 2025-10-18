import db from '../config/db.js';

class ChatRepository {
  /**
   * Create a new chat session for a learner
   */
  async createSession(learnerId, language = null, sessionTitle = 'New Chat') {
    const sessionToken = this.generateSessionToken();
    const result = await db.query(
      `INSERT INTO ai_chat_sessions (learner_id, language, session_title, session_token, is_active, message_count)
       VALUES ($1, $2, $3, $4, true, 0)
       RETURNING id, learner_id, language, session_title, session_token, started_at, is_active, message_count`,
      [learnerId, language, sessionTitle, sessionToken]
    );
    return result.rows[0];
  }

  /**
   * Find session by ID
   */
  async findSessionById(sessionId) {
    const result = await db.query(
      `SELECT * FROM ai_chat_sessions WHERE id = $1`,
      [sessionId]
    );
    return result.rows[0];
  }

  /**
   * Find session by token
   */
  async findSessionByToken(sessionToken) {
    const result = await db.query(
      `SELECT * FROM ai_chat_sessions WHERE session_token = $1`,
      [sessionToken]
    );
    return result.rows[0];
  }

  /**
   * Get all sessions for a learner
   */
  async findSessionsByLearnerId(learnerId, activeOnly = false) {
    let query = `
      SELECT s.*, 
             COUNT(m.id) as total_messages,
             MAX(m.created_at) as last_message_at
      FROM ai_chat_sessions s
      LEFT JOIN ai_chat_messages m ON s.id = m.session_id
      WHERE s.learner_id = $1
    `;
    
    if (activeOnly) {
      query += ` AND s.is_active = true`;
    }
    
    query += `
      GROUP BY s.id
      ORDER BY s.started_at DESC
    `;
    
    const result = await db.query(query, [learnerId]);
    return result.rows;
  }

  /**
   * Save a message to a session
   */
  async createMessage(sessionId, sender, message) {
    const result = await db.query(
      `INSERT INTO ai_chat_messages (session_id, sender, message)
       VALUES ($1, $2, $3)
       RETURNING id, session_id, sender, message, created_at`,
      [sessionId, sender, message]
    );

    // Update message count
    await db.query(
      `UPDATE ai_chat_sessions 
       SET message_count = message_count + 1 
       WHERE id = $1`,
      [sessionId]
    );

    return result.rows[0];
  }

  /**
   * Get messages for a session
   */
  async getMessagesBySessionId(sessionId, limit = 100, offset = 0) {
    const result = await db.query(
      `SELECT id, session_id, sender, message, created_at
       FROM ai_chat_messages
       WHERE session_id = $1
       ORDER BY created_at ASC
       LIMIT $2 OFFSET $3`,
      [sessionId, limit, offset]
    );
    return result.rows;
  }

  /**
   * Get recent messages for context (most recent first for AI)
   */
  async getRecentMessages(sessionId, count = 10) {
    const result = await db.query(
      `SELECT id, sender, message, created_at
       FROM ai_chat_messages
       WHERE session_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [sessionId, count]
    );
    return result.rows.reverse(); // Return in chronological order
  }

  /**
   * Update session title
   */
  async updateSessionTitle(sessionId, title) {
    const result = await db.query(
      `UPDATE ai_chat_sessions
       SET session_title = $2
       WHERE id = $1
       RETURNING *`,
      [sessionId, title]
    );
    return result.rows[0];
  }

  /**
   * End a session (mark as inactive)
   */
  async endSession(sessionId) {
    const result = await db.query(
      `UPDATE ai_chat_sessions
       SET is_active = false, ended_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [sessionId]
    );
    return result.rows[0];
  }

  /**
   * Delete a session and all its messages
   */
  async deleteSession(sessionId) {
    await db.query(
      `DELETE FROM ai_chat_sessions WHERE id = $1`,
      [sessionId]
    );
  }

  /**
   * Delete all sessions for a learner
   */
  async deleteAllSessionsByLearnerId(learnerId) {
    await db.query(
      `DELETE FROM ai_chat_sessions WHERE learner_id = $1`,
      [learnerId]
    );
  }

  /**
   * Get session count for a learner
   */
  async getSessionCount(learnerId) {
    const result = await db.query(
      `SELECT COUNT(*) as count FROM ai_chat_sessions WHERE learner_id = $1`,
      [learnerId]
    );
    return parseInt(result.rows[0].count);
  }

  /**
   * Get message count for a session
   */
  async getMessageCount(sessionId) {
    const result = await db.query(
      `SELECT COUNT(*) as count FROM ai_chat_messages WHERE session_id = $1`,
      [sessionId]
    );
    return parseInt(result.rows[0].count);
  }

  /**
   * Generate a unique session token
   */
  generateSessionToken() {
    return `chat_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Check if session belongs to learner
   */
  async sessionBelongsToLearner(sessionId, learnerId) {
    const result = await db.query(
      `SELECT EXISTS(SELECT 1 FROM ai_chat_sessions WHERE id = $1 AND learner_id = $2) as exists`,
      [sessionId, learnerId]
    );
    return result.rows[0].exists;
  }
}

export default new ChatRepository();
