import db from '../config/db.js';

class CourseRepository {
  /**
   * Find active course by language and user
   */
  async findActiveCourseByLanguage(userId, language) {
    const result = await db.query(
      'SELECT * FROM courses WHERE learner_id = $1 AND language = $2 AND is_active = $3',
      [userId, language, true]
    );
    return result.rows[0] || null;
  }

  /**
   * Create a new course
   */
  async createCourse(userId, language, expectedDuration, courseData) {
    // Extract metadata from courseData
    const title = courseData.course?.title || `${language} Learning Journey`;
    const description = courseData.course?.description || `Learn ${language} in ${expectedDuration}`;
    const totalLessons = courseData.metadata?.totalLessons || 0;
    const totalUnits = courseData.metadata?.totalUnits || 0;
    const estimatedTotalTime = courseData.metadata?.estimatedTotalTime || 0;

    const result = await db.query(
      `INSERT INTO courses (
        learner_id, language, expected_duration, title, description,
        total_lessons, total_units, estimated_total_time,
        course_data, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()) RETURNING id`,
      [userId, language, expectedDuration, title, description, totalLessons, totalUnits, estimatedTotalTime, courseData, true]
    );
    const courseId = result.rows[0].id;

    // Populate course_units and course_lessons tables
    await this.populateCourseStructure(courseId, courseData);

    return courseId;
  }

  /**
   * Populate course_units and course_lessons tables from courseData
   */
  async populateCourseStructure(courseId, courseData) {
    const units = courseData.course?.units || [];

    for (const unit of units) {
      // Insert unit
      const unitResult = await db.query(
        `INSERT INTO course_units (
          course_id, unit_id, title, description, difficulty, estimated_time, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING id`,
        [
          courseId,
          unit.id,
          unit.title,
          unit.description,
          unit.difficulty,
          parseInt(unit.estimatedTime) || unit.estimatedTime?.match(/\d+/)?.[0] || 150
        ]
      );
      const unitDbId = unitResult.rows[0].id;

      // Insert lessons for this unit
      const lessons = unit.lessons || [];
      for (const lesson of lessons) {
        await db.query(
          `INSERT INTO course_lessons (
            course_id, unit_id, lesson_id, title, lesson_type, description,
            key_phrases, vocabulary, grammar_points, exercises,
            estimated_duration, xp_reward, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11, $12, NOW(), NOW())`,
          [
            courseId,
            unitDbId,
            lesson.id,
            lesson.title,
            lesson.type || lesson.lessonType || 'vocabulary',
            lesson.description || '',
            lesson.keyPhrases || lesson.key_phrases || [],
            JSON.stringify(lesson.vocabulary || {}),
            JSON.stringify(lesson.grammarPoints || lesson.grammar_points || {}),
            JSON.stringify(lesson.exercises || []),
            lesson.estimatedDuration || lesson.duration || 15,
            lesson.xpReward || lesson.xp_reward || 50
          ]
        );
      }
    }
  }

  /**
   * Find lesson database ID by course, unit number, and lesson number
   */
  async findLessonDbId(courseId, unitNumber, lessonNumber) {
    const result = await db.query(
      `SELECT cl.id 
       FROM course_lessons cl
       JOIN course_units cu ON cl.unit_id = cu.id
       WHERE cl.course_id = $1 AND cu.unit_id = $2 AND cl.lesson_id = $3
       LIMIT 1`,
      [courseId, unitNumber, lessonNumber]
    );
    return result.rows[0]?.id || null;
  }

  /**
   * Find learner courses with stats
   */
  async findLearnerCoursesWithStats(userId) {
    const result = await db.query(
      `SELECT c.*,
        COALESCE((
          SELECT SUM(lp.xp_earned) FROM lesson_progress lp WHERE lp.learner_id = c.learner_id AND lp.course_id = c.id
        ), 0) as total_xp,
        COALESCE((
          SELECT COUNT(*) FROM lesson_progress lp WHERE lp.learner_id = c.learner_id AND lp.course_id = c.id AND lp.is_completed = true
        ), 0) as lessons_completed,
        COALESCE((
          SELECT COUNT(*) FROM unit_progress up WHERE up.learner_id = c.learner_id AND up.course_id = c.id AND up.is_completed = true
        ), 0) as units_completed,
        COALESCE(us.current_streak, 0) as current_streak,
        ROUND(
          COALESCE((
            SELECT COUNT(*) FROM lesson_progress lp WHERE lp.learner_id = c.learner_id AND lp.course_id = c.id AND lp.is_completed = true
          ), 0) * 100.0 /
          GREATEST((c.course_data->'metadata'->>'totalLessons')::int, 1), 1
        ) as progress_percentage
       FROM courses c
       LEFT JOIN user_stats us ON c.id = us.course_id AND c.learner_id = us.learner_id
       WHERE c.learner_id = $1 AND c.is_active = true
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
      'SELECT * FROM courses WHERE id = $1 AND learner_id = $2 AND is_active = $3',
      [courseId, userId, true]
    );
    return result.rows[0] || null;
  }

  /**
   * Find course data by ID and user
   */
  async findCourseDataById(courseId, userId) {
    const result = await db.query(
      'SELECT course_data FROM courses WHERE id = $1 AND learner_id = $2 AND is_active = $3',
      [courseId, userId, true]
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
        COALESCE((
          SELECT SUM(lp.xp_earned) FROM lesson_progress lp WHERE lp.learner_id = c.learner_id AND lp.course_id = c.id
        ), 0) as total_xp,
        COALESCE((
          SELECT COUNT(*) FROM lesson_progress lp WHERE lp.learner_id = c.learner_id AND lp.course_id = c.id AND lp.is_completed = true
        ), 0) as lessons_completed,
        COALESCE((
          SELECT COUNT(*) FROM unit_progress up WHERE up.learner_id = c.learner_id AND up.course_id = c.id AND up.is_completed = true
        ), 0) as units_completed,
        COALESCE(us.current_streak, 0) as current_streak,
        ROUND(
          COALESCE((
            SELECT COUNT(*) FROM lesson_progress lp WHERE lp.learner_id = c.learner_id AND lp.course_id = c.id AND lp.is_completed = true
          ), 0) * 100.0 /
          GREATEST((c.course_data->'metadata'->>'totalLessons')::int, 1), 1
        ) as progress_percentage
       FROM courses c
       LEFT JOIN user_stats us ON c.id = us.course_id AND c.learner_id = us.learner_id
       WHERE c.learner_id = $1 AND c.is_active = true
       ORDER BY c.created_at DESC`,
      [userId]
    );
    return result.rows;
  }
}

export default new CourseRepository();
