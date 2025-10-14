import db from '../config/db.js';

class CourseRepository {
  /**
   * Find active course by language and user
   */
  async findActiveCourseByLanguage(userId, language) {
    const result = await db.query(
      'SELECT * FROM courses WHERE user_id = $1 AND language = $2 AND status = $3',
      [userId, language, 'active']
    );
    return result.rows[0] || null;
  }

  /**
   * Create a new course
   */
  async createCourse(userId, language, expectedDuration, courseData) {
    const result = await db.query(
      'INSERT INTO courses (user_id, language, expected_duration, course_data, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING id',
      [userId, language, expectedDuration, JSON.stringify(courseData), 'active']
    );
    return result.rows[0].id;
  }

  /**
   * Find learner courses with stats
   */
  async findLearnerCoursesWithStats(userId) {
    const result = await db.query(
      `SELECT c.*,
        COALESCE(up.total_xp, 0) as total_xp,
        COALESCE(up.lessons_completed, 0) as lessons_completed,
        COALESCE(up.units_completed, 0) as units_completed,
        COALESCE(up.current_streak, 0) as current_streak
       FROM courses c
       LEFT JOIN user_progress up ON c.id = up.course_id
       WHERE c.user_id = $1 AND c.status = 'active'
       ORDER BY c.created_at DESC`,
      [userId]
    );
    return result.rows;
  }

  /**
   * Find course by ID and user
   */
  async findCourseById(courseId, userId) {
    const result = await db.query(
      'SELECT * FROM courses WHERE id = $1 AND user_id = $2 AND status = $3',
      [courseId, userId, 'active']
    );
    return result.rows[0] || null;
  }

  /**
   * Find course data by ID and user
   */
  async findCourseDataById(courseId, userId) {
    const result = await db.query(
      'SELECT course_data FROM courses WHERE id = $1 AND user_id = $2 AND status = $3',
      [courseId, userId, 'active']
    );
    const row = result.rows[0];
    return row ? { course_data: row.course_data } : null;
  }

  /**
   * Find all active courses
   */
  async findAllActiveCourses(userId) {
    const result = await db.query(
      `SELECT c.*,
        COALESCE(up.total_xp, 0) as total_xp,
        COALESCE(up.lessons_completed, 0) as lessons_completed,
        COALESCE(up.units_completed, 0) as units_completed,
        COALESCE(up.current_streak, 0) as current_streak
       FROM courses c
       LEFT JOIN user_progress up ON c.id = up.course_id
       WHERE c.user_id = $1 AND c.status = 'active'
       ORDER BY c.created_at DESC`,
      [userId]
    );
    return result.rows;
  }
}

export default new CourseRepository();
