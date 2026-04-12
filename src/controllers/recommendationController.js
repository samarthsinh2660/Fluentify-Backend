import astarService from '../services/astarService.js';
import knowledgeGraphRepository from '../repositories/knowledgeGraphRepository.js';
import courseRepository from '../repositories/courseRepository.js';
import conceptExtractionService from '../services/conceptExtractionService.js';
import { successResponse, listResponse } from '../utils/response.js';
import { ERRORS } from '../utils/error.js';

class RecommendationController {
  /**
   * Compute A* recommendations for the learner's active course.
   * GET /api/recommendations/:courseId
   */
  async getRecommendations(req, res, next) {
    try {
      const { id, role } = req.user;
      const { courseId } = req.params;

      if (role !== 'learner') {
        throw ERRORS.LEARNER_ONLY_ROUTE;
      }

      // Verify the course belongs to this learner
      const course = await courseRepository.findCourseById(courseId, id);
      if (!course) {
        throw ERRORS.COURSE_NOT_FOUND;
      }

      const cId = parseInt(courseId);

      // If no concept nodes exist yet, trigger extraction on-demand and await it
      const existingNodes = await knowledgeGraphRepository.findConceptNodesByCourse(cId);
      if (existingNodes.length === 0) {
        console.log(`⏳ No concept nodes for course ${cId} — running extraction on-demand...`);
        try {
          await conceptExtractionService.extractConceptsForCourse(cId, course.course_data);
        } catch (err) {
          console.error('On-demand concept extraction failed:', err.message);
        }
      }

      const result = await astarService.computeRecommendations(id, cId);

      res.json(successResponse(result, 'Recommendations computed successfully'));
    } catch (error) {
      console.error('Error computing recommendations:', error);
      next(error);
    }
  }

  /**
   * Get the learner's concept mastery profile for a course.
   * GET /api/recommendations/:courseId/mastery
   */
  async getMasteryProfile(req, res, next) {
    try {
      const { id, role } = req.user;
      const { courseId } = req.params;

      if (role !== 'learner') {
        throw ERRORS.LEARNER_ONLY_ROUTE;
      }

      const course = await courseRepository.findCourseById(courseId, id);
      if (!course) {
        throw ERRORS.COURSE_NOT_FOUND;
      }

      const masteryRows = await knowledgeGraphRepository.findConceptMasteryForLearner(
        id, parseInt(courseId)
      );

      if (masteryRows.length === 0) {
        throw ERRORS.CONCEPT_GRAPH_NOT_FOUND;
      }

      // Group by concept type
      const byType = { vocabulary: [], grammar: [], conversation: [], review: [] };
      for (const row of masteryRows) {
        const bucket = byType[row.concept_type];
        if (bucket) {
          bucket.push({
            conceptId:    row.id,
            conceptLabel: row.concept_label,
            masteryScore: parseFloat(row.mastery_score) || 0,
            attempts:     parseInt(row.attempts)        || 0,
          });
        }
      }

      const avg = arr =>
        arr.length === 0 ? 0 : arr.reduce((s, v) => s + v.masteryScore, 0) / arr.length;

      const profile = {
        overall:      avg(masteryRows.map(r => ({ masteryScore: parseFloat(r.mastery_score) || 0 }))),
        vocabulary:   avg(byType.vocabulary),
        grammar:      avg(byType.grammar),
        conversation: avg(byType.conversation),
        review:       avg(byType.review),
        breakdown:    byType,
      };

      res.json(successResponse(profile, 'Mastery profile retrieved successfully'));
    } catch (error) {
      console.error('Error fetching mastery profile:', error);
      next(error);
    }
  }

  /**
   * Get the full knowledge graph for a course with learner mastery overlay.
   * Learner: own graph only.
   * Admin: any learner's graph via ?learnerId=X query param.
   *
   * GET /api/recommendations/:courseId/graph
   */
  async getKnowledgeGraph(req, res, next) {
    try {
      const { id, role } = req.user;
      const { courseId }  = req.params;

      // Determine which learner's graph to return
      let targetLearnerId = id;

      if (role === 'admin') {
        if (!req.query.learnerId) {
          throw ERRORS.MISSING_REQUIRED_FIELDS;
        }
        targetLearnerId = parseInt(req.query.learnerId);
      } else {
        // Learner can only access their own graph
        const course = await courseRepository.findCourseById(courseId, id);
        if (!course) {
          throw ERRORS.COURSE_NOT_FOUND;
        }
      }

      const cId = parseInt(courseId);

      // If no concept nodes exist yet, trigger extraction on-demand and await it
      const existingNodes = await knowledgeGraphRepository.findConceptNodesByCourse(cId);
      if (existingNodes.length === 0) {
        console.log(`⏳ No concept nodes for course ${cId} — running extraction on-demand...`);
        try {
          const courseForExtraction = await courseRepository.findCourseById(cId, targetLearnerId);
          if (courseForExtraction) {
            await conceptExtractionService.extractConceptsForCourse(cId, courseForExtraction.course_data);
          }
        } catch (err) {
          console.error('On-demand concept extraction failed:', err.message);
        }
      }

      const [nodes, edges] = await Promise.all([
        knowledgeGraphRepository.findConceptMasteryForLearner(targetLearnerId, cId),
        knowledgeGraphRepository.findConceptEdgesByCourse(cId),
      ]);

      if (nodes.length === 0) {
        throw ERRORS.CONCEPT_GRAPH_NOT_FOUND;
      }

      // Get latest recommendation to overlay A* path
      const latestRec = await knowledgeGraphRepository.findLatestRecommendation(
        targetLearnerId, cId
      );

      const graphNodes = nodes.map(n => ({
        id:                    n.id,
        conceptKey:            n.concept_key,
        conceptLabel:          n.concept_label,
        conceptType:           n.concept_type,
        difficulty:            parseFloat(n.difficulty) || 0.5,
        estimatedMasteryTime:  parseInt(n.estimated_mastery_time) || 15,
        lessonDbId:            n.lesson_db_id,
        masteryScore:          parseFloat(n.mastery_score) || 0,
        attempts:              parseInt(n.attempts)        || 0,
        correctCount:          parseInt(n.correct_count)   || 0,
        status:                this.deriveStatus(parseFloat(n.mastery_score) || 0, parseInt(n.attempts) || 0),
      }));

      const graphEdges = edges.map(e => ({
        id:            e.id,
        fromConceptId: e.from_concept_id,
        toConceptId:   e.to_concept_id,
        edgeWeight:    parseFloat(e.edge_weight) || 1.0,
      }));

      // full_path_data stores the complete A* result object (JSONB)
      let astarPath = [];
      if (latestRec?.full_path_data) {
        const pathData = typeof latestRec.full_path_data === 'string'
          ? JSON.parse(latestRec.full_path_data)
          : latestRec.full_path_data;
        astarPath = pathData?.fullPath ?? (Array.isArray(pathData) ? pathData : []);
      }

      res.json(successResponse({
        nodes:    graphNodes,
        edges:    graphEdges,
        astarPath,
        stats: {
          total:     graphNodes.length,
          mastered:  graphNodes.filter(n => n.status === 'mastered').length,
          learning:  graphNodes.filter(n => n.status === 'learning').length,
          weak:      graphNodes.filter(n => n.status === 'weak').length,
          untouched: graphNodes.filter(n => n.status === 'untouched').length,
        },
      }, 'Knowledge graph retrieved successfully'));
    } catch (error) {
      console.error('Error fetching knowledge graph:', error);
      next(error);
    }
  }

  /**
   * Force-rebuild the concept graph for a course.
   * Deletes existing nodes/edges, re-runs concept extraction with Gemini.
   * POST /api/recommendations/:courseId/rebuild-graph
   */
  async rebuildGraph(req, res, next) {
    try {
      const { id, role } = req.user;
      const { courseId } = req.params;

      if (role !== 'learner') throw ERRORS.LEARNER_ONLY_ROUTE;

      const course = await courseRepository.findCourseById(courseId, id);
      if (!course) throw ERRORS.COURSE_NOT_FOUND;

      const cId = parseInt(courseId);

      console.log(`🔄 Rebuilding concept graph for course ${cId}...`);
      await knowledgeGraphRepository.deleteConceptGraphForCourse(cId);
      await conceptExtractionService.extractConceptsForCourse(cId, course.course_data);

      const nodes = await knowledgeGraphRepository.findConceptNodesByCourse(cId);
      const edges = await knowledgeGraphRepository.findConceptEdgesByCourse(cId);

      res.json(successResponse(
        { nodeCount: nodes.length, edgeCount: edges.length },
        `Concept graph rebuilt — ${nodes.length} nodes, ${edges.length} edges`
      ));
    } catch (error) {
      console.error('Error rebuilding concept graph:', error);
      next(error);
    }
  }

  /**
   * Mark a recommendation as followed by the learner.
   * POST /api/recommendations/:courseId/follow
   * Body: { recommendationId }
   */
  async markFollowed(req, res, next) {
    try {
      const { role }           = req.user;
      const { recommendationId } = req.body;

      if (role !== 'learner') {
        throw ERRORS.LEARNER_ONLY_ROUTE;
      }

      if (!recommendationId) {
        throw ERRORS.MISSING_REQUIRED_FIELDS;
      }

      await knowledgeGraphRepository.markRecommendationFollowed(recommendationId);

      res.json(successResponse(null, 'Recommendation marked as followed'));
    } catch (error) {
      console.error('Error marking recommendation followed:', error);
      next(error);
    }
  }

  /**
   * Derive a human-readable status label from mastery score + attempts.
   */
  deriveStatus(masteryScore, attempts) {
    if (attempts === 0)      return 'untouched';
    if (masteryScore >= 0.8) return 'mastered';
    if (masteryScore >= 0.5) return 'learning';
    return 'weak';
  }
}

export default new RecommendationController();
