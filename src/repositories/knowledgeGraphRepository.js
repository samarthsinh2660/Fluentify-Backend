import db from '../config/db.js';

class KnowledgeGraphRepository {
  // ─── Concept Nodes ────────────────────────────────────────────────────────

  /**
   * Bulk-insert concept nodes for a course.
   * Skips duplicates silently (same course_id + concept_key).
   * Returns only the rows that were actually inserted.
   */
  async saveConceptNodes(courseId, nodes) {
    if (!nodes || nodes.length === 0) return [];

    const saved = [];

    for (const node of nodes) {
      const result = await db.query(
        `INSERT INTO concept_nodes
           (course_id, lesson_db_id, concept_key, concept_label, concept_type,
            difficulty, estimated_mastery_time)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (course_id, concept_key) DO NOTHING
         RETURNING *`,
        [
          courseId,
          node.lessonDbId,
          node.concept_key,
          node.concept_label,
          node.concept_type,
          node.difficulty,
          node.estimated_mastery_time,
        ]
      );

      if (result.rows[0]) {
        saved.push(result.rows[0]);
      }
    }

    return saved;
  }

  /**
   * Bulk-insert concept edges.
   * Skips duplicate (from, to) pairs silently.
   */
  async saveConceptEdges(courseId, edges) {
    if (!edges || edges.length === 0) return;

    for (const edge of edges) {
      await db.query(
        `INSERT INTO concept_edges (course_id, from_concept_id, to_concept_id, edge_weight)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (from_concept_id, to_concept_id) DO NOTHING`,
        [courseId, edge.from_concept_id, edge.to_concept_id, edge.edge_weight]
      );
    }
  }

  /**
   * Get all concept nodes for a course, ordered by insertion (graph build order).
   */
  async findConceptNodesByCourse(courseId) {
    const result = await db.query(
      'SELECT * FROM concept_nodes WHERE course_id = $1 ORDER BY id',
      [courseId]
    );
    return result.rows;
  }

  /**
   * Get all concept edges for a course.
   */
  async findConceptEdgesByCourse(courseId) {
    const result = await db.query(
      'SELECT * FROM concept_edges WHERE course_id = $1',
      [courseId]
    );
    return result.rows;
  }

  /**
   * Get all concept nodes linked to a specific lesson (by DB id).
   * Used in progressController to know which concepts to update after lesson complete.
   */
  async findConceptNodesByLesson(lessonDbId) {
    const result = await db.query(
      'SELECT * FROM concept_nodes WHERE lesson_db_id = $1',
      [lessonDbId]
    );
    return result.rows;
  }

  /**
   * Resolve the course_lessons.id from unit number + lesson number.
   * Needed during concept extraction to link concept → lesson DB row.
   */
  async findLessonDbIdByCourseAndLesson(courseId, unitNumber, lessonNumber) {
    const result = await db.query(
      `SELECT cl.id
       FROM course_lessons cl
       JOIN course_units cu ON cl.unit_id = cu.id
       WHERE cl.course_id = $1
         AND cu.unit_id   = $2
         AND cl.lesson_id = $3
       LIMIT 1`,
      [courseId, unitNumber, lessonNumber]
    );
    return result.rows[0]?.id || null;
  }

  // ─── Concept Mastery ──────────────────────────────────────────────────────

  /**
   * Get all concept nodes for a course with this learner's mastery scores joined.
   * Concepts the learner hasn't touched yet get mastery_score = 0.
   */
  async findConceptMasteryForLearner(learnerId, courseId) {
    const result = await db.query(
      `SELECT cn.*,
              COALESCE(cm.mastery_score, 0) AS mastery_score,
              COALESCE(cm.attempts, 0)      AS attempts,
              COALESCE(cm.correct_count, 0) AS correct_count,
              cm.last_updated
       FROM concept_nodes cn
       LEFT JOIN concept_mastery cm
              ON cn.id = cm.concept_id AND cm.learner_id = $2
       WHERE cn.course_id = $1
       ORDER BY cn.id`,
      [courseId, learnerId]
    );
    return result.rows;
  }

  /**
   * Create or update a concept mastery row after a lesson is completed.
   * attempts and correct_count are incremental — added to existing totals.
   */
  async upsertConceptMastery(learnerId, courseId, conceptId, masteryScore, attempts, correctCount) {
    await db.query(
      `INSERT INTO concept_mastery
         (learner_id, course_id, concept_id, mastery_score, attempts, correct_count, last_updated)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (learner_id, concept_id)
       DO UPDATE SET
         mastery_score = $4,
         attempts      = concept_mastery.attempts      + $5,
         correct_count = concept_mastery.correct_count + $6,
         last_updated  = NOW()`,
      [learnerId, courseId, conceptId, masteryScore, attempts, correctCount]
    );
  }

  // ─── Recommendation History ───────────────────────────────────────────────

  /**
   * Delete all concept nodes and edges for a course (used before force-rebuild).
   */
  async deleteConceptGraphForCourse(courseId) {
    // Edges reference nodes via FK — delete edges first
    await db.query('DELETE FROM concept_edges WHERE course_id = $1', [courseId]);
    await db.query('DELETE FROM concept_nodes WHERE course_id = $1', [courseId]);
  }

  /**
   * Persist a full A* run result to recommendation_history.
   */
  async saveRecommendation(learnerId, courseId, result) {
    const top = result.recommendations?.[0];

    // full_path_data stores the complete result object (recommendations + path + stats)
    // so downstream consumers like chatService can read all recommendations, not just the top one
    await db.query(
      `INSERT INTO recommendation_history
         (learner_id, course_id, recommended_concept_id, recommended_lesson_db_id,
          f_score, g_score, h_score, reason, urgency, full_path_data, mastery_snapshot)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        learnerId,
        courseId,
        top?.conceptId    || null,
        top?.lessonDbId   || null,
        top?.fScore       || null,
        top?.gScore       || null,
        top?.hScore       || null,
        top?.reason       || null,
        top?.urgency      || 'normal',
        JSON.stringify(result),
        JSON.stringify(result.masteryProfile || {}),
      ]
    );
  }

  /**
   * Get the most recent A* recommendation for a learner in a course.
   */
  async findLatestRecommendation(learnerId, courseId) {
    const result = await db.query(
      `SELECT * FROM recommendation_history
       WHERE learner_id = $1 AND course_id = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [learnerId, courseId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get the last N recommendation runs for a learner in a course.
   */
  async findRecommendationHistory(learnerId, courseId, limit = 10) {
    const result = await db.query(
      `SELECT * FROM recommendation_history
       WHERE learner_id = $1 AND course_id = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [learnerId, courseId, limit]
    );
    return result.rows;
  }

  /**
   * Mark a recommendation as followed (learner acted on it).
   */
  async markRecommendationFollowed(recommendationId) {
    await db.query(
      'UPDATE recommendation_history SET was_followed = TRUE WHERE id = $1',
      [recommendationId]
    );
  }

  // ─── Remedial Lessons (Phase 9) ───────────────────────────────────────────

  /**
   * Check if a remedial lesson already exists for a concept in this course.
   * Returns the lesson DB id or null.
   */
  async findExistingRemedialLesson(courseId, conceptId) {
    const result = await db.query(
      `SELECT id FROM course_lessons
       WHERE course_id = $1
         AND remedial_for_concept_id = $2
         AND is_remedial = TRUE
       LIMIT 1`,
      [courseId, conceptId]
    );
    return result.rows[0]?.id || null;
  }

  /**
   * Insert a Gemini-generated remedial lesson into course_lessons.
   * lesson_id is set to max(lesson_id)+1 for the unit to avoid collisions.
   */
  async saveRemedialLesson(courseId, unitDbId, conceptId, lessonData) {
    const maxResult = await db.query(
      `SELECT COALESCE(MAX(lesson_id), 0) AS max_id
       FROM course_lessons
       WHERE course_id = $1 AND unit_id = $2`,
      [courseId, unitDbId]
    );

    const nextLessonId = parseInt(maxResult.rows[0].max_id) + 1;

    const result = await db.query(
      `INSERT INTO course_lessons
         (course_id, unit_id, lesson_id, title, lesson_type, description,
          vocabulary, grammar_points, exercises, estimated_duration, xp_reward,
          is_remedial, remedial_for_concept_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6,
               $7::jsonb, $8::jsonb, $9::jsonb,
               $10, $11, TRUE, $12, NOW(), NOW())
       RETURNING id`,
      [
        courseId,
        unitDbId,
        nextLessonId,
        lessonData.title,
        lessonData.type,
        lessonData.description || '',
        JSON.stringify(lessonData.vocabulary    || []),
        JSON.stringify(lessonData.grammarPoints || []),
        JSON.stringify(lessonData.exercises     || []),
        lessonData.estimatedDuration || 15,
        lessonData.xpReward          || 60,
        conceptId,
      ]
    );

    return result.rows[0].id;
  }
}

export default new KnowledgeGraphRepository();
