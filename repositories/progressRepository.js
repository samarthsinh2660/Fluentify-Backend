const db = require('../config/db');

class ProgressRepository {
  /**
   * Get all unit progress for a course
   */
  async findUnitProgress(userId, courseId) {
    const result = await db.query(
      `SELECT unit_id, is_unlocked, is_completed 
       FROM unit_progress 
       WHERE learner_id = $1 AND course_id = $2
       ORDER BY unit_id`,
      [userId, courseId]
    );
    return result.rows;
  }

  /**
   * Get all lesson progress for a course
   */
  async findLessonProgress(userId, courseId) {
    const result = await db.query(
      `SELECT unit_id, lesson_number, is_completed, score, xp_earned
       FROM lesson_progress 
       WHERE learner_id = $1 AND course_id = $2
       ORDER BY unit_id, lesson_number`,
      [userId, courseId]
    );
    return result.rows;
  }

  /**
   * Get specific lesson progress
   */
  async findSpecificLessonProgress(userId, courseId, unitId, lessonId) {
    const result = await db.query(
      `SELECT * FROM lesson_progress 
       WHERE learner_id = $1 AND course_id = $2 AND unit_id = $3 AND lesson_number = $4`,
      [userId, courseId, unitId, lessonId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get user stats for a course
   */
  async findUserStats(userId, courseId) {
    const result = await db.query(
      `SELECT * FROM user_stats WHERE learner_id = $1 AND course_id = $2`,
      [userId, courseId]
    );
    return result.rows[0] || null;
  }

  /**
   * Create or update lesson progress
   */
  async upsertLessonProgress(userId, courseId, unitId, lessonId, score, xpEarned) {
    await db.query(
      `INSERT INTO lesson_progress (learner_id, course_id, unit_id, lesson_number, is_completed, score, xp_earned, completed_time)
       VALUES ($1, $2, $3, $4, TRUE, $5, $6, NOW())
       ON CONFLICT (learner_id, course_id, unit_id, lesson_number) 
       DO UPDATE SET is_completed = TRUE, score = $5, xp_earned = $6, completed_time = NOW()`,
      [userId, courseId, unitId, lessonId, score, xpEarned]
    );
  }

  /**
   * Save exercise attempt
   */
  async createExerciseAttempt(userId, courseId, unitId, lessonId, exerciseIndex, isCorrect, userAnswer) {
    await db.query(
      `INSERT INTO exercise_attempts (learner_id, course_id, unit_id, lesson_id, exercise_index, is_correct, user_answer)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, courseId, unitId, lessonId, exerciseIndex, isCorrect, userAnswer]
    );
  }

  /**
   * Count completed lessons in a unit
   */
  async countCompletedLessonsInUnit(userId, courseId, unitId) {
    const result = await db.query(
      'SELECT COUNT(*) as total FROM lesson_progress WHERE learner_id = $1 AND course_id = $2 AND unit_id = $3 AND is_completed = TRUE',
      [userId, courseId, unitId]
    );
    return parseInt(result.rows[0].total);
  }

  /**
   * Mark unit as complete
   */
  async markUnitComplete(userId, courseId, unitId) {
    await db.query(
      `INSERT INTO unit_progress (learner_id, course_id, unit_id, is_unlocked, is_completed, completed_at)
       VALUES ($1, $2, $3, TRUE, TRUE, NOW())
       ON CONFLICT (learner_id, course_id, unit_id)
       DO UPDATE SET is_completed = TRUE, completed_at = NOW()`,
      [userId, courseId, unitId]
    );
  }

  /**
   * Unlock next unit
   */
  async unlockUnit(userId, courseId, unitId) {
    await db.query(
      `INSERT INTO unit_progress (learner_id, course_id, unit_id, is_unlocked, is_completed)
       VALUES ($1, $2, $3, TRUE, FALSE)
       ON CONFLICT (learner_id, course_id, unit_id)
       DO UPDATE SET is_unlocked = TRUE`,
      [userId, courseId, unitId]
    );
  }

  /**
   * Create initial user stats
   */
  async createUserStats(userId, courseId, xpEarned, unitsCompleted, today) {
    await db.query(
      `INSERT INTO user_stats (learner_id, course_id, total_xp, lessons_completed, units_completed, current_streak, last_activity_date)
       VALUES ($1, $2, $3, 1, $4, 1, $5)`,
      [userId, courseId, xpEarned, unitsCompleted, today]
    );
  }

  /**
   * Update user stats
   */
  async updateUserStats(userId, courseId, xpEarned, unitsCompleted, newStreak, today) {
    await db.query(
      `UPDATE user_stats SET 
        total_xp = total_xp + $1,
        lessons_completed = lessons_completed + 1,
        units_completed = units_completed + $2,
        current_streak = $3,
        longest_streak = GREATEST(longest_streak, $3),
        last_activity_date = $4,
        updated_at = NOW()
       WHERE learner_id = $5 AND course_id = $6`,
      [xpEarned, unitsCompleted, newStreak, today, userId, courseId]
    );
  }

  /**
   * Initialize course progress (unlock first unit and create stats)
   */
  async initializeCourseProgress(courseId, userId) {
    // Unlock first unit
    await db.query(
      `INSERT INTO unit_progress (learner_id, course_id, unit_id, is_unlocked, is_completed)
       VALUES ($1, $2, 1, TRUE, FALSE)
       ON CONFLICT (learner_id, course_id, unit_id) DO NOTHING`,
      [userId, courseId]
    );

    // Initialize user stats
    await db.query(
      `INSERT INTO user_stats (learner_id, course_id, total_xp, lessons_completed, units_completed, current_streak, longest_streak)
       VALUES ($1, $2, 0, 0, 0, 0, 0)
       ON CONFLICT (learner_id, course_id) DO NOTHING`,
      [userId, courseId]
    );
  }
}

module.exports = new ProgressRepository();
