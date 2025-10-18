import db from '../config/db.js';

class ContestRepository {
  /**
   * Create a new contest
   */
  async createContest(contestData) {
    const {
      adminId,
      title,
      description,
      language,
      difficultyLevel,
      contestType,
      questions,
      totalQuestions,
      maxAttempts,
      timeLimit,
      rewardPoints,
      startDate,
      endDate,
      isPublished,
      isAiGenerated
    } = contestData;

    const result = await db.query(
      `INSERT INTO contests (
        admin_id, title, description, language, difficulty_level,
        contest_type, questions, total_questions, max_attempts, time_limit,
        reward_points, start_date, end_date, is_published, is_ai_generated
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        adminId, title, description, language, difficultyLevel,
        contestType, JSON.stringify(questions), totalQuestions, maxAttempts, timeLimit,
        rewardPoints, startDate, endDate, isPublished, isAiGenerated
      ]
    );

    return result.rows[0];
  }

  /**
   * Find contest by ID
   */
  async findById(contestId) {
    const result = await db.query(
      `SELECT c.*, a.name as admin_name, a.email as admin_email
       FROM contests c
       LEFT JOIN admins a ON c.admin_id = a.id
       WHERE c.id = $1`,
      [contestId]
    );
    return result.rows[0];
  }

  /**
   * Get all contests with optional filters
   */
  async findAll(filters = {}) {
    let query = `
      SELECT c.*, a.name as admin_name,
             (SELECT COUNT(*) FROM contest_submissions WHERE contest_id = c.id) as total_participants
      FROM contests c
      LEFT JOIN admins a ON c.admin_id = a.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (filters.language) {
      query += ` AND c.language = $${paramCount}`;
      params.push(filters.language);
      paramCount++;
    }

    if (filters.difficultyLevel) {
      query += ` AND c.difficulty_level = $${paramCount}`;
      params.push(filters.difficultyLevel);
      paramCount++;
    }

    if (filters.contestType) {
      query += ` AND c.contest_type = $${paramCount}`;
      params.push(filters.contestType);
      paramCount++;
    }

    if (filters.isPublished !== undefined) {
      query += ` AND c.is_published = $${paramCount}`;
      params.push(filters.isPublished);
      paramCount++;
    }

    if (filters.adminId) {
      query += ` AND c.admin_id = $${paramCount}`;
      params.push(filters.adminId);
      paramCount++;
    }

    if (filters.active) {
      const now = new Date();
      query += ` AND c.start_date <= $${paramCount} AND c.end_date >= $${paramCount}`;
      params.push(now);
      paramCount++;
    }

    query += ` ORDER BY c.created_at DESC`;

    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Get published contests for learners
   */
  async getPublishedContests(language = null) {
    let query = `
      SELECT c.*,
             (SELECT COUNT(*) FROM contest_submissions WHERE contest_id = c.id) as total_participants
      FROM contests c
      WHERE c.is_published = true
    `;
    const params = [];

    if (language) {
      query += ` AND c.language = $1`;
      params.push(language);
    }

    query += ` ORDER BY c.start_date DESC`;

    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Update contest
   */
  async updateContest(contestId, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = [
      'title', 'description', 'language', 'difficulty_level', 'contest_type',
      'questions', 'total_questions', 'max_attempts', 'time_limit',
      'reward_points', 'start_date', 'end_date', 'is_published'
    ];

    Object.keys(updates).forEach(key => {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowedFields.includes(snakeKey)) {
        fields.push(`${snakeKey} = $${paramCount}`);
        values.push(snakeKey === 'questions' ? JSON.stringify(updates[key]) : updates[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      return null;
    }

    fields.push(`updated_at = NOW()`);
    values.push(contestId);

    const query = `
      UPDATE contests
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Delete contest
   */
  async deleteContest(contestId) {
    await db.query('DELETE FROM contests WHERE id = $1', [contestId]);
  }

  /**
   * Submit contest answers
   */
  async submitContest(submissionData) {
    const {
      contestId,
      learnerId,
      answers,
      score,
      totalCorrect,
      totalQuestions,
      percentage,
      timeTaken
    } = submissionData;

    const result = await db.query(
      `INSERT INTO contest_submissions (
        contest_id, learner_id, answers, score, total_correct,
        total_questions, percentage, time_taken
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (contest_id, learner_id)
      DO UPDATE SET
        answers = $3,
        score = $4,
        total_correct = $5,
        percentage = $7,
        time_taken = $8,
        submitted_at = NOW()
      RETURNING *`,
      [contestId, learnerId, JSON.stringify(answers), score, totalCorrect, totalQuestions, percentage, timeTaken]
    );

    return result.rows[0];
  }

  /**
   * Get user's submission for a contest
   */
  async getUserSubmission(contestId, learnerId) {
    const result = await db.query(
      `SELECT * FROM contest_submissions
       WHERE contest_id = $1 AND learner_id = $2`,
      [contestId, learnerId]
    );
    return result.rows[0];
  }

  /**
   * Get contest leaderboard
   */
  async getLeaderboard(contestId, limit = 100) {
    const result = await db.query(
      `SELECT cl.*, l.name as learner_name, l.email as learner_email
       FROM contest_leaderboard cl
       JOIN learners l ON cl.learner_id = l.id
       WHERE cl.contest_id = $1
       ORDER BY cl.rank ASC
       LIMIT $2`,
      [contestId, limit]
    );
    return result.rows;
  }

  /**
   * Get user's rank in contest
   */
  async getUserRank(contestId, learnerId) {
    const result = await db.query(
      `SELECT rank, score, percentage, time_taken
       FROM contest_leaderboard
       WHERE contest_id = $1 AND learner_id = $2`,
      [contestId, learnerId]
    );
    return result.rows[0];
  }

  /**
   * Get contest statistics
   */
  async getContestStats(contestId) {
    const result = await db.query(
      `SELECT 
         COUNT(DISTINCT cs.learner_id) as total_participants,
         AVG(cs.score) as average_score,
         MAX(cs.score) as highest_score,
         MIN(cs.score) as lowest_score,
         AVG(cs.percentage) as average_percentage
       FROM contest_submissions cs
       WHERE cs.contest_id = $1`,
      [contestId]
    );
    return result.rows[0];
  }

  /**
   * Check if user has already submitted
   */
  async hasUserSubmitted(contestId, learnerId) {
    const result = await db.query(
      `SELECT EXISTS(
        SELECT 1 FROM contest_submissions 
        WHERE contest_id = $1 AND learner_id = $2
      ) as exists`,
      [contestId, learnerId]
    );
    return result.rows[0].exists;
  }

  /**
   * Get user's attempt count
   */
  async getUserAttemptCount(contestId, learnerId) {
    const result = await db.query(
      `SELECT COUNT(*) as count FROM contest_submissions
       WHERE contest_id = $1 AND learner_id = $2`,
      [contestId, learnerId]
    );
    return parseInt(result.rows[0].count);
  }
}

export default new ContestRepository();
