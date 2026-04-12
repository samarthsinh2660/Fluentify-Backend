import courseRepository from '../repositories/courseRepository.js';
import progressRepository from '../repositories/progressRepository.js';
import knowledgeGraphRepository from '../repositories/knowledgeGraphRepository.js';
import { computeConceptMastery } from '../utils/masteryUtils.js';
import { successResponse, listResponse } from '../utils/response.js';
import { ERRORS } from '../utils/error.js';

/**
 * Get user's course progress
 */
const getCourseProgress = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { courseId } = req.params;

    // Get course data
    const course = await courseRepository.findCourseById(courseId, userId);

    if (!course) {
      throw ERRORS.COURSE_NOT_FOUND;
    }

    // Get unit progress
    const unitProgress = await progressRepository.findUnitProgress(userId, courseId);

    // Get lesson progress
    const lessonProgress = await progressRepository.findLessonProgress(userId, courseId);

    // Get user stats
    const stats = await progressRepository.findUserStats(userId, courseId);

    res.json(successResponse({
      course: course.course_data || {},
      unitProgress: unitProgress,
      lessonProgress: lessonProgress,
      stats: stats || {
        total_xp: 0,
        lessons_completed: 0,
        units_completed: 0,
        current_streak: 0,
        longest_streak: 0
      }
    }, 'Course progress retrieved successfully'));
  } catch (error) {
    console.error('Error fetching course progress:', error);
    next(error);
  }
};

/**
 * Mark lesson as complete
 */
const markLessonComplete = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { courseId, unitId, lessonId } = req.params;
    const { score = 100, exercises = [] } = req.body || {};

    // Get course data to calculate XP
    const courseResult = await courseRepository.findCourseDataById(courseId, userId);

    if (!courseResult) {
      throw ERRORS.COURSE_NOT_FOUND;
    }

    const courseData = courseResult.course_data;
    const unit = courseData.course.units.find(u => u.id === parseInt(unitId));
    const lesson = unit?.lessons.find(l => l.id === parseInt(lessonId));

    if (!lesson) {
      throw ERRORS.LESSON_NOT_FOUND;
    }

    const xpEarned = lesson.xpReward || 50;

    // Resolve both the lesson DB id and the unit DB id (serial PKs, not logical numbers)
    const [lessonDbId, unitDbId] = await Promise.all([
      courseRepository.findLessonDbId(courseId, parseInt(unitId), parseInt(lessonId)),
      courseRepository.findUnitDbId(courseId, parseInt(unitId)),
    ]);

    if (!lessonDbId) {
      throw ERRORS.LESSON_NOT_FOUND;
    }

    if (!unitDbId) {
      throw ERRORS.COURSE_NOT_FOUND;
    }

    // Check if lesson already completed
    const existingProgress = await progressRepository.findSpecificLessonProgress(userId, courseId, parseInt(unitId), parseInt(lessonId));

    if (existingProgress && existingProgress.is_completed) {
      throw ERRORS.LESSON_ALREADY_COMPLETED;
    }

    // Mark lesson as complete (unitDbId = FK reference to course_units.id)
    await progressRepository.upsertLessonProgress(userId, courseId, unitDbId, lessonDbId, score, xpEarned);

    // Save exercise attempts
    for (let i = 0; i < exercises.length; i++) {
      const exercise = exercises[i];
      await progressRepository.createExerciseAttempt(
        userId, courseId, unitDbId, lessonDbId, i,
        exercise.isCorrect, exercise.userAnswer
      );
    }

    // Update concept mastery for all concepts linked to this lesson (fire-and-forget)
    knowledgeGraphRepository.findConceptNodesByLesson(lessonDbId)
      .then(async (lessonConcepts) => {
        for (const concept of lessonConcepts) {
          const masteryScore = computeConceptMastery(score, exercises, concept.concept_type);
          await knowledgeGraphRepository.upsertConceptMastery(
            userId, parseInt(courseId), concept.id, masteryScore,
            exercises.length,
            exercises.filter(e => e.isCorrect).length
          );
        }
      })
      .catch(err => console.error('Concept mastery update failed silently:', err.message));

    // Check if all lessons in unit are completed
    const totalLessonsInUnit = unit.lessons.length;
    const completedLessons = await progressRepository.countCompletedLessonsInUnit(userId, courseId, parseInt(unitId));

    let unitCompleted = false;
    if (completedLessons >= totalLessonsInUnit) {
      // Mark unit complete using DB id
      await progressRepository.markUnitComplete(userId, courseId, unitDbId);

      // Unlock next unit — look up its DB id too
      const nextUnitNumber = parseInt(unitId) + 1;
      const nextUnit = courseData.course.units.find(u => u.id === nextUnitNumber);

      if (nextUnit) {
        const nextUnitDbId = await courseRepository.findUnitDbId(courseId, nextUnitNumber);
        if (nextUnitDbId) {
          await progressRepository.unlockUnit(userId, courseId, nextUnitDbId);
        }
      }

      unitCompleted = true;
    }

    // Update user stats (only streak tracking now)
    const today = new Date().toISOString().split('T')[0];
    const stats = await progressRepository.findUserStats(userId, courseId);

    if (!stats) {
      // Create new stats (only for streak tracking)
      await progressRepository.createUserStats(userId, courseId, 0, 0, today);
    } else {
      // Update only streak information
      const lastDate = stats.last_activity_date ? new Date(stats.last_activity_date).toISOString().split('T')[0] : null;
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      let newStreak = 1;
      if (lastDate === yesterdayStr) {
        newStreak = stats.current_streak + 1;
      } else if (lastDate === today) {
        newStreak = stats.current_streak;
      }

      await progressRepository.updateUserStreak(userId, courseId, newStreak, today);
    }

    res.json(successResponse({
      xpEarned,
      unitCompleted
    }, unitCompleted ? 'Unit completed! Next unit unlocked!' : 'Lesson completed!'));
  } catch (error) {
    console.error('Error marking lesson complete:', error);
    next(error);
  }
};

/**
 * Get available courses for user
 */
const getUserCourses = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const courses = await courseRepository.findAllActiveCourses(userId);

    const coursesWithProgress = courses.map(course => ({
      id: course.id,
      language: course.language,
      title: course.title,
      createdAt: course.created_at,
      progress: {
        totalXp: course.total_xp || 0,
        lessonsCompleted: course.lessons_completed || 0,
        unitsCompleted: course.units_completed || 0,
        currentStreak: course.current_streak || 0
      }
    }));

    res.json(listResponse(coursesWithProgress, 'User courses retrieved successfully'));
  } catch (error) {
    console.error('Error fetching user courses:', error);
    next(error);
  }
};

/**
 * Initialize progress for a new course
 */
const initializeCourseProgress = async (courseId, userId) => {
  try {
    await progressRepository.initializeCourseProgress(courseId, userId);
  } catch (error) {
    console.error('Error initializing course progress:', error);
    throw error;
  }
};

/**
 * Retry a completed lesson — update concept mastery only.
 * No XP re-award, no completion status change.
 * Called when the user re-takes the quiz on an already-completed lesson.
 */
const retryLesson = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { courseId, unitId, lessonId } = req.params;
    const { score = 100, exercises = [] } = req.body || {};

    const lessonDbId = await courseRepository.findLessonDbId(
      courseId, parseInt(unitId), parseInt(lessonId)
    );

    if (!lessonDbId) {
      throw ERRORS.LESSON_NOT_FOUND;
    }

    // Update concept mastery for all concepts linked to this lesson
    const lessonConcepts = await knowledgeGraphRepository.findConceptNodesByLesson(lessonDbId);
    for (const concept of lessonConcepts) {
      const masteryScore = computeConceptMastery(score, exercises, concept.concept_type);
      await knowledgeGraphRepository.upsertConceptMastery(
        userId, parseInt(courseId), concept.id, masteryScore,
        exercises.length,
        exercises.filter(e => e.isCorrect).length
      );
    }

    res.json(successResponse({
      score,
      conceptsUpdated: lessonConcepts.length,
    }, 'Mastery updated successfully'));
  } catch (error) {
    console.error('Error retrying lesson:', error);
    next(error);
  }
};

export {
  getCourseProgress,
  markLessonComplete,
  retryLesson,
  getUserCourses,
  initializeCourseProgress
};
