const db = require('../config/db');

class CourseRepository {
  /**
   * Check if user has an active course for a language
   */
  async findActiveCourseByLanguage(userId, language) {
    const result = await db.query(
      'SELECT id FROM courses WHERE learner_id = $1 AND language = $2 AND is_active = TRUE',
      [userId, language]
    );
    return result.rows[0] || null;
  }

  /**
   * Create a new course
   */
  async createCourse(userId, language, expectedDuration, courseData) {
    const result = await db.query(
      `INSERT INTO courses (learner_id, language, expected_duration, title, description, 
        total_lessons, total_units, estimated_total_time, course_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        userId,
        language,
        expectedDuration,
        courseData.course.title,
        `AI-generated ${language} course for ${expectedDuration}`,
        courseData.metadata.totalLessons,
        courseData.metadata.totalUnits,
        courseData.metadata.estimatedTotalTime,
        JSON.stringify(courseData)
      ]
    );
    return result.rows[0].id;
  }

  /**
   * Get all courses for a learner with stats
   */
  async findLearnerCoursesWithStats(userId) {
    const result = await db.query(
      `SELECT 
        c.id, c.language, c.title, c.created_at, c.course_data,
        us.total_xp, us.lessons_completed, us.units_completed, us.current_streak
       FROM courses c
       LEFT JOIN user_stats us ON c.id = us.course_id AND us.learner_id = c.learner_id
       WHERE c.learner_id = $1 AND c.is_active = TRUE
       ORDER BY c.created_at DESC`,
      [userId]
    );
    return result.rows;
  }

  /**
   * Get course by ID and user ID
   */
  async findCourseById(courseId, userId) {
    const result = await db.query(
      `SELECT * FROM courses WHERE id = $1 AND learner_id = $2`,
      [courseId, userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get course data only
   */
  async findCourseDataById(courseId, userId) {
    const result = await db.query(
      `SELECT course_data FROM courses WHERE id = $1 AND learner_id = $2`,
      [courseId, userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get all active courses for a user
   */
  async findAllActiveCourses(userId) {
    const result = await db.query(
      `SELECT 
        c.*,
        us.total_xp,
        us.lessons_completed,
        us.units_completed,
        us.current_streak
       FROM courses c
       LEFT JOIN user_stats us ON c.id = us.course_id AND us.learner_id = c.learner_id
       WHERE c.learner_id = $1 AND c.is_active = TRUE
       ORDER BY c.created_at DESC`,
      [userId]
    );
    return result.rows;
  }
}

module.exports = new CourseRepository();
