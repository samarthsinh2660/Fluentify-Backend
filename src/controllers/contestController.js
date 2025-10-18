import contestRepository from '../repositories/contestRepository.js';
import contestService from '../services/contestService.js';
import { createdResponse, successResponse, listResponse, deletedResponse } from '../utils/response.js';
import { ERRORS } from '../utils/error.js';

class ContestController {
  // ================== ADMIN ENDPOINTS ==================

  /**
   * Generate contest using AI
   * POST /api/contests/generate
   */
  async generateContest(req, res, next) {
    try {
      const { id, role } = req.user;
      const {
        language,
        difficultyLevel,
        contestType,
        questionCount = 10,
        topic,
        title,
        description,
        startDate,
        endDate,
        rewardPoints = 100,
        maxAttempts = 1,
        timeLimit,
        isPublished = false
      } = req.body;

      if (role !== 'admin') {
        throw ERRORS.ADMIN_ONLY_ROUTE;
      }

      // Validate required fields
      if (!language || !difficultyLevel || !contestType) {
        throw ERRORS.MISSING_REQUIRED_FIELDS;
      }

      if (!['mcq', 'one-liner', 'mix'].includes(contestType)) {
        throw ERRORS.INVALID_CONTEST_TYPE;
      }

      // Generate contest using AI
      const generatedContest = await contestService.generateContest({
        language,
        difficultyLevel,
        contestType,
        questionCount,
        topic
      });

      // Create contest in database
      const contest = await contestRepository.createContest({
        adminId: id,
        title: title || generatedContest.title,
        description: description || generatedContest.description,
        language,
        difficultyLevel,
        contestType,
        questions: generatedContest.questions,
        totalQuestions: generatedContest.questions.length,
        maxAttempts,
        timeLimit,
        rewardPoints,
        startDate,
        endDate,
        isPublished,
        isAiGenerated: true
      });

      res.status(201).json(createdResponse({
        contest: {
          id: contest.id,
          title: contest.title,
          description: contest.description,
          language: contest.language,
          difficultyLevel: contest.difficulty_level,
          contestType: contest.contest_type,
          questions: contest.questions,
          totalQuestions: contest.total_questions,
          isAiGenerated: contest.is_ai_generated,
          isPublished: contest.is_published
        }
      }, 'Contest generated successfully using AI'));
    } catch (error) {
      console.error('Error generating contest:', error);
      next(error.message.includes('Gemini') ? ERRORS.CONTEST_GENERATION_FAILED : error);
    }
  }

  /**
   * Create contest manually
   * POST /api/contests
   */
  async createContest(req, res, next) {
    try {
      const { id, role } = req.user;
      const {
        title,
        description,
        language,
        difficultyLevel,
        contestType,
        questions,
        maxAttempts = 1,
        timeLimit,
        rewardPoints = 100,
        startDate,
        endDate,
        isPublished = false
      } = req.body;

      if (role !== 'admin') {
        throw ERRORS.ADMIN_ONLY_ROUTE;
      }

      // Validate required fields
      if (!title || !language || !difficultyLevel || !contestType || !questions || !startDate || !endDate) {
        throw ERRORS.MISSING_REQUIRED_FIELDS;
      }

      if (!['mcq', 'one-liner', 'mix'].includes(contestType)) {
        throw ERRORS.INVALID_CONTEST_TYPE;
      }

      if (!Array.isArray(questions) || questions.length === 0) {
        throw ERRORS.INVALID_QUESTION_FORMAT;
      }

      // Validate questions structure
      try {
        contestService.validateContestStructure({ title, questions }, contestType);
      } catch (validationError) {
        throw ERRORS.INVALID_QUESTION_FORMAT;
      }

      // Create contest
      const contest = await contestRepository.createContest({
        adminId: id,
        title,
        description,
        language,
        difficultyLevel,
        contestType,
        questions,
        totalQuestions: questions.length,
        maxAttempts,
        timeLimit,
        rewardPoints,
        startDate,
        endDate,
        isPublished,
        isAiGenerated: false
      });

      res.status(201).json(createdResponse({
        contest: {
          id: contest.id,
          title: contest.title,
          description: contest.description,
          language: contest.language,
          difficultyLevel: contest.difficulty_level,
          contestType: contest.contest_type,
          totalQuestions: contest.total_questions,
          isPublished: contest.is_published
        }
      }, 'Contest created successfully'));
    } catch (error) {
      console.error('Error creating contest:', error);
      next(error);
    }
  }

  /**
   * Get all contests (admin can see all, filter by admin_id)
   * GET /api/contests/admin
   */
  async getAdminContests(req, res, next) {
    try {
      const { id, role } = req.user;
      const { language, difficulty_level, contest_type, is_published } = req.query;

      if (role !== 'admin') {
        throw ERRORS.ADMIN_ONLY_ROUTE;
      }

      const filters = {
        adminId: id,
        language,
        difficultyLevel: difficulty_level,
        contestType: contest_type,
        isPublished: is_published === 'true' ? true : is_published === 'false' ? false : undefined
      };

      const contests = await contestRepository.findAll(filters);

      res.json(listResponse(
        contests.map(c => ({
          id: c.id,
          title: c.title,
          description: c.description,
          language: c.language,
          difficultyLevel: c.difficulty_level,
          contestType: c.contest_type,
          totalQuestions: c.total_questions,
          maxAttempts: c.max_attempts,
          timeLimit: c.time_limit,
          rewardPoints: c.reward_points,
          startDate: c.start_date,
          endDate: c.end_date,
          isPublished: c.is_published,
          isAiGenerated: c.is_ai_generated,
          totalParticipants: parseInt(c.total_participants) || 0,
          createdAt: c.created_at
        })),
        'Contests retrieved successfully',
        { count: contests.length }
      ));
    } catch (error) {
      console.error('Error fetching admin contests:', error);
      next(error);
    }
  }

  /**
   * Update contest
   * PATCH /api/contests/:contestId
   */
  async updateContest(req, res, next) {
    try {
      const { role } = req.user;
      const { contestId } = req.params;

      if (role !== 'admin') {
        throw ERRORS.ADMIN_ONLY_ROUTE;
      }

      const contest = await contestRepository.findById(contestId);
      if (!contest) {
        throw ERRORS.CONTEST_NOT_FOUND;
      }

      const updatedContest = await contestRepository.updateContest(contestId, req.body);

      res.json(successResponse({
        contest: {
          id: updatedContest.id,
          title: updatedContest.title,
          description: updatedContest.description,
          isPublished: updatedContest.is_published
        }
      }, 'Contest updated successfully'));
    } catch (error) {
      console.error('Error updating contest:', error);
      next(error);
    }
  }

  /**
   * Delete contest
   * DELETE /api/contests/:contestId
   */
  async deleteContest(req, res, next) {
    try {
      const { role } = req.user;
      const { contestId } = req.params;

      if (role !== 'admin') {
        throw ERRORS.ADMIN_ONLY_ROUTE;
      }

      const contest = await contestRepository.findById(contestId);
      if (!contest) {
        throw ERRORS.CONTEST_NOT_FOUND;
      }

      await contestRepository.deleteContest(contestId);

      res.json(deletedResponse('Contest deleted successfully'));
    } catch (error) {
      console.error('Error deleting contest:', error);
      next(error);
    }
  }

  /**
   * Get contest statistics (admin only)
   * GET /api/contests/:contestId/stats
   */
  async getContestStats(req, res, next) {
    try {
      const { role } = req.user;
      const { contestId } = req.params;

      if (role !== 'admin') {
        throw ERRORS.ADMIN_ONLY_ROUTE;
      }

      const contest = await contestRepository.findById(contestId);
      if (!contest) {
        throw ERRORS.CONTEST_NOT_FOUND;
      }

      const stats = await contestRepository.getContestStats(contestId);

      res.json(successResponse({
        stats: {
          totalParticipants: parseInt(stats.total_participants) || 0,
          averageScore: parseFloat(stats.average_score) || 0,
          highestScore: parseInt(stats.highest_score) || 0,
          lowestScore: parseInt(stats.lowest_score) || 0,
          averagePercentage: parseFloat(stats.average_percentage) || 0
        }
      }, 'Contest statistics retrieved successfully'));
    } catch (error) {
      console.error('Error fetching contest stats:', error);
      next(error);
    }
  }

  // ================== LEARNER ENDPOINTS ==================

  /**
   * Get published contests for learners
   * GET /api/contests
   */
  async getPublishedContests(req, res, next) {
    try {
      const { id, role } = req.user;
      const { language } = req.query;

      if (role !== 'learner') {
        throw ERRORS.LEARNER_ONLY_ROUTE;
      }

      const contests = await contestRepository.getPublishedContests(language);

      const now = new Date();
      
      // Enrich contests with submission status
      const enrichedContests = await Promise.all(contests.map(async (c) => {
        const hasSubmitted = await contestRepository.hasUserSubmitted(c.id, id);
        
        return {
          id: c.id,
          title: c.title,
          description: c.description,
          language: c.language,
          difficultyLevel: c.difficulty_level,
          contestType: c.contest_type,
          totalQuestions: c.total_questions,
          maxAttempts: c.max_attempts,
          timeLimit: c.time_limit,
          rewardPoints: c.reward_points,
          startDate: c.start_date,
          endDate: c.end_date,
          totalParticipants: parseInt(c.total_participants) || 0,
          status: new Date(c.end_date) < now ? 'ended' : new Date(c.start_date) > now ? 'upcoming' : 'active',
          hasSubmitted: hasSubmitted
        };
      }));

      res.json(listResponse(enrichedContests, 'Published contests retrieved successfully', { count: enrichedContests.length }));
    } catch (error) {
      console.error('Error fetching published contests:', error);
      next(error);
    }
  }

  /**
   * Get contest details (without answers)
   * GET /api/contests/:contestId
   */
  async getContestDetails(req, res, next) {
    try {
      const { id, role } = req.user;
      const { contestId } = req.params;

      const contest = await contestRepository.findById(contestId);
      if (!contest) {
        throw ERRORS.CONTEST_NOT_FOUND;
      }

      // Learners can only see published contests
      if (role === 'learner' && !contest.is_published) {
        throw ERRORS.CONTEST_NOT_PUBLISHED;
      }

      // Prepare questions without correct answers for learners
      let questions = contest.questions;
      if (role === 'learner') {
        questions = questions.map(q => {
          const { correctAnswer, acceptableAnswers, explanation, ...safeQuestion } = q;
          return safeQuestion;
        });
      }

      // Check if user has already submitted
      let userSubmission = null;
      let userRank = null;
      let submissionDetails = null;

      if (role === 'learner') {
        userSubmission = await contestRepository.getUserSubmission(contestId, id);
        
        if (userSubmission) {
          // Get user's rank
          userRank = await contestRepository.getUserRank(contestId, id);
          
          // Prepare submission details
          submissionDetails = {
            score: userSubmission.score,
            totalCorrect: userSubmission.total_correct,
            totalQuestions: userSubmission.total_questions,
            percentage: parseFloat(userSubmission.percentage),
            timeTaken: userSubmission.time_taken,
            submittedAt: userSubmission.submitted_at,
            rank: userRank?.rank || null
          };
        }
      }

      // Determine contest status
      const now = new Date();
      let contestStatus = 'active';
      if (new Date(contest.end_date) < now) {
        contestStatus = 'ended';
      } else if (new Date(contest.start_date) > now) {
        contestStatus = 'upcoming';
      }

      res.json(successResponse({
        contest: {
          id: contest.id,
          title: contest.title,
          description: contest.description,
          language: contest.language,
          difficultyLevel: contest.difficulty_level,
          contestType: contest.contest_type,
          questions,
          totalQuestions: contest.total_questions,
          maxAttempts: contest.max_attempts,
          timeLimit: contest.time_limit,
          rewardPoints: contest.reward_points,
          startDate: contest.start_date,
          endDate: contest.end_date,
          status: contestStatus,
          hasSubmitted: !!userSubmission,
          submission: submissionDetails
        }
      }, 'Contest details retrieved successfully'));
    } catch (error) {
      console.error('Error fetching contest details:', error);
      next(error);
    }
  }

  /**
   * Submit contest answers
   * POST /api/contests/:contestId/submit
   */
  async submitContest(req, res, next) {
    try {
      const { id, role } = req.user;
      const { contestId } = req.params;
      const { answers, timeTaken } = req.body;

      if (role !== 'learner') {
        throw ERRORS.LEARNER_ONLY_ROUTE;
      }

      // Get contest
      const contest = await contestRepository.findById(contestId);
      if (!contest) {
        throw ERRORS.CONTEST_NOT_FOUND;
      }

      if (!contest.is_published) {
        throw ERRORS.CONTEST_NOT_PUBLISHED;
      }

      // Check contest timing
      const now = new Date();
      if (new Date(contest.start_date) > now) {
        throw ERRORS.CONTEST_NOT_STARTED;
      }
      if (new Date(contest.end_date) < now) {
        throw ERRORS.CONTEST_ENDED;
      }

      // Check if already submitted
      const hasSubmitted = await contestRepository.hasUserSubmitted(contestId, id);
      if (hasSubmitted) {
        throw ERRORS.CONTEST_ALREADY_SUBMITTED;
      }

      // Validate answers
      const validation = contestService.validateAnswers(contest.questions, answers);
      if (!validation.valid) {
        throw ERRORS.INVALID_ANSWERS_FORMAT;
      }

      // Calculate score
      const scoreResult = contestService.calculateScore(contest.questions, answers);

      // Submit contest
      const submission = await contestRepository.submitContest({
        contestId,
        learnerId: id,
        answers,
        score: scoreResult.score,
        totalCorrect: scoreResult.totalCorrect,
        totalQuestions: scoreResult.totalQuestions,
        percentage: scoreResult.percentage,
        timeTaken
      });

      res.status(201).json(createdResponse({
        submission: {
          id: submission.id,
          score: submission.score,
          totalCorrect: submission.total_correct,
          totalQuestions: submission.total_questions,
          percentage: parseFloat(submission.percentage),
          timeTaken: submission.time_taken,
          submittedAt: submission.submitted_at,
          results: scoreResult.results
        }
      }, 'Contest submitted successfully'));
    } catch (error) {
      console.error('Error submitting contest:', error);
      next(error);
    }
  }

  /**
   * Get contest leaderboard
   * GET /api/contests/:contestId/leaderboard
   */
  async getLeaderboard(req, res, next) {
    try {
      const { contestId } = req.params;
      const { limit = 100 } = req.query;

      const contest = await contestRepository.findById(contestId);
      if (!contest) {
        throw ERRORS.CONTEST_NOT_FOUND;
      }

      const leaderboard = await contestRepository.getLeaderboard(contestId, parseInt(limit));

      res.json(listResponse(
        leaderboard.map(entry => ({
          rank: entry.rank,
          learnerName: entry.learner_name,
          score: entry.score,
          percentage: parseFloat(entry.percentage),
          timeTaken: entry.time_taken,
          submittedAt: entry.submitted_at
        })),
        'Leaderboard retrieved successfully',
        { count: leaderboard.length }
      ));
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      next(error);
    }
  }

  /**
   * Get user's contest submission
   * GET /api/contests/:contestId/my-submission
   */
  async getMySubmission(req, res, next) {
    try {
      const { id, role } = req.user;
      const { contestId } = req.params;

      if (role !== 'learner') {
        throw ERRORS.LEARNER_ONLY_ROUTE;
      }

      const submission = await contestRepository.getUserSubmission(contestId, id);
      if (!submission) {
        return res.json(successResponse({ submission: null }, 'No submission found'));
      }

      const rank = await contestRepository.getUserRank(contestId, id);

      res.json(successResponse({
        submission: {
          id: submission.id,
          score: submission.score,
          totalCorrect: submission.total_correct,
          totalQuestions: submission.total_questions,
          percentage: parseFloat(submission.percentage),
          timeTaken: submission.time_taken,
          submittedAt: submission.submitted_at,
          rank: rank?.rank || null
        }
      }, 'Submission retrieved successfully'));
    } catch (error) {
      console.error('Error fetching submission:', error);
      next(error);
    }
  }
}

export default new ContestController();
