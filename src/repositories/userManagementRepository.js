import db from '../config/db.js';

/**
 * User Management Repository
 * Admin operations for managing learner users
 */
class UserManagementRepository {
  /**
   * Get all learners with pagination and search
   */
  async getAllLearners(page = 1, limit = 10, search = '') {
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT 
        l.id, 
        l.name, 
        l.email, 
        l.created_at,
        l.updated_at,
        EXISTS(SELECT 1 FROM learner_preferences WHERE learner_id = l.id) as has_preferences,
        COUNT(DISTINCT c.id) as total_courses,
        COALESCE(SUM(us.total_xp), 0) as total_xp
      FROM learners l
      LEFT JOIN courses c ON c.learner_id = l.id
      LEFT JOIN user_stats us ON us.learner_id = l.id
    `;
    
    const params = [];
    
    if (search) {
      query += ` WHERE l.name ILIKE $1 OR l.email ILIKE $1`;
      params.push(`%${search}%`);
    }
    
    query += ` GROUP BY l.id ORDER BY l.created_at DESC`;
    
    // Get total count
    const countQuery = search 
      ? `SELECT COUNT(*) FROM learners WHERE name ILIKE $1 OR email ILIKE $1`
      : `SELECT COUNT(*) FROM learners`;
    
    const countResult = await db.query(countQuery, search ? [`%${search}%`] : []);
    const totalCount = parseInt(countResult.rows[0].count);
    
    // Get paginated results
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    
    const result = await db.query(query, params);
    
    return {
      learners: result.rows,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    };
  }

  /**
   * Get learner by ID with detailed stats
   */
  async getLearnerById(learnerId) {
    const query = `
      SELECT 
        l.id, 
        l.name, 
        l.email, 
        l.created_at,
        l.updated_at,
        EXISTS(SELECT 1 FROM learner_preferences WHERE learner_id = l.id) as has_preferences,
        COUNT(DISTINCT c.id) as total_courses,
        COALESCE(SUM(us.total_xp), 0) as total_xp,
        COALESCE(SUM(us.lessons_completed), 0) as total_lessons_completed,
        COALESCE(MAX(us.current_streak), 0) as current_streak
      FROM learners l
      LEFT JOIN courses c ON c.learner_id = l.id
      LEFT JOIN user_stats us ON us.learner_id = l.id
      WHERE l.id = $1
      GROUP BY l.id
    `;
    
    const result = await db.query(query, [learnerId]);
    return result.rows[0] || null;
  }

  /**
   * Update learner details (name, email)
   */
  async updateLearner(learnerId, name, email) {
    const query = `
      UPDATE learners 
      SET name = $1, email = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING id, name, email, created_at, updated_at
    `;
    
    const result = await db.query(query, [name, email, learnerId]);
    return result.rows[0] || null;
  }

  /**
   * Update learner password
   */
  async updateLearnerPassword(learnerId, passwordHash) {
    const query = `
      UPDATE learners 
      SET password_hash = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id
    `;
    
    const result = await db.query(query, [passwordHash, learnerId]);
    return result.rows[0] || null;
  }

  /**
   * Delete learner and all related data
   */
  async deleteLearner(learnerId) {
    // This will cascade delete all related data due to foreign key constraints
    const query = `DELETE FROM learners WHERE id = $1 RETURNING id`;
    
    const result = await db.query(query, [learnerId]);
    return result.rows[0] || null;
  }

  /**
   * Check if email exists (excluding a specific user ID for updates)
   */
  async checkEmailExists(email, excludeUserId = null) {
    let query = `SELECT id FROM learners WHERE email = $1`;
    const params = [email];
    
    if (excludeUserId) {
      query += ` AND id != $2`;
      params.push(excludeUserId);
    }
    
    const result = await db.query(query, params);
    return result.rows.length > 0;
  }

  /**
   * Get learner's courses
   */
  async getLearnerCourses(learnerId) {
    const query = `
      SELECT 
        c.id,
        c.language,
        c.expected_duration,
        c.created_at,
        COALESCE(us.total_xp, 0) as total_xp,
        COALESCE(us.lessons_completed, 0) as lessons_completed
      FROM courses c
      LEFT JOIN user_stats us ON us.course_id = c.id
      WHERE c.learner_id = $1
      ORDER BY c.created_at DESC
    `;
    
    const result = await db.query(query, [learnerId]);
    return result.rows;
  }
}

export default new UserManagementRepository();
