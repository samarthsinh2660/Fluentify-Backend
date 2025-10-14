const courseRepository = require('../repositories/courseRepository');
const progressRepository = require('../repositories/progressRepository');
const { successResponse, listResponse } = require('../utils/response');
const { ERRORS } = require('../utils/error');

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
    const { score = 100, exercises = [] } = req.body;

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

    // Check if lesson already completed
    const existingProgress = await progressRepository.findSpecificLessonProgress(userId, courseId, unitId, lessonId);

    if (existingProgress && existingProgress.is_completed) {
      throw ERRORS.LESSON_ALREADY_COMPLETED;
    }

    // Mark lesson as complete
    await progressRepository.upsertLessonProgress(userId, courseId, unitId, lessonId, score, xpEarned);

    // Save exercise attempts
    for (let i = 0; i < exercises.length; i++) {
      const exercise = exercises[i];
      await progressRepository.createExerciseAttempt(
        userId, courseId, unitId, lessonId, i, 
        exercise.isCorrect, exercise.userAnswer
      );
    }

    // Check if all lessons in unit are completed
    const totalLessonsInUnit = unit.lessons.length;
    const completedLessons = await progressRepository.countCompletedLessonsInUnit(userId, courseId, unitId);

    let unitCompleted = false;
    if (completedLessons >= totalLessonsInUnit) {
      // Mark unit as complete
      await progressRepository.markUnitComplete(userId, courseId, unitId);

      // Unlock next unit
      const nextUnitId = parseInt(unitId) + 1;
      const nextUnit = courseData.course.units.find(u => u.id === nextUnitId);
      
      if (nextUnit) {
        await progressRepository.unlockUnit(userId, courseId, nextUnitId);
      }

      unitCompleted = true;
    }

    // Update user stats
    const today = new Date().toISOString().split('T')[0];
    
    const stats = await progressRepository.findUserStats(userId, courseId);

    if (!stats) {
      // Create new stats
      await progressRepository.createUserStats(userId, courseId, xpEarned, unitCompleted ? 1 : 0, today);
    } else {
      // Update existing stats
      const lastDate = stats.last_activity_date;
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      let newStreak = 1;
      if (lastDate === yesterdayStr) {
        newStreak = stats.current_streak + 1;
      } else if (lastDate === today) {
        newStreak = stats.current_streak;
      }

      await progressRepository.updateUserStats(userId, courseId, xpEarned, unitCompleted ? 1 : 0, newStreak, today);
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

module.exports = {
  getCourseProgress,
  markLessonComplete,
  getUserCourses,
  initializeCourseProgress
};
