import geminiService from '../services/geminiService.js';
import courseRepository from '../repositories/courseRepository.js';
import progressRepository from '../repositories/progressRepository.js';
import { successResponse, createdResponse, listResponse } from '../utils/response.js';
import { ERRORS } from '../utils/error.js';

class CourseController {
  /**
   * Generate a new course for a learner
   */
  async generateCourse(req, res, next) {
    try {
      const { language, expectedDuration } = req.body;
      const userId = req.user.id;

      console.log('📥 Received request body:', req.body);
      console.log('🌍 Language:', language);
      console.log('⏱️  Duration:', expectedDuration);

      if (!language && !expectedDuration) {
        throw ERRORS.MISSING_REQUIRED_FIELDS;
      }
      if (!language) {
        throw ERRORS.LANGUAGE_REQUIRED;
      }
      if (!expectedDuration) {
        throw ERRORS.DURATION_REQUIRED;
      }

      // Check if user already has an active course for this language
      const existingCourse = await courseRepository.findActiveCourseByLanguage(userId, language);

      if (existingCourse) {
        throw ERRORS.DUPLICATE_ACTIVE_COURSE;
      }

      console.log(`🚀 Starting course generation for ${language}...`);
      
      // Generate course content using Gemini (chunked generation)
      const courseData = await geminiService.generateCourse(language, expectedDuration);

      console.log('Saving course to database...');
      
      // Save course to database with course_data
      const courseId = await courseRepository.createCourse(userId, language, expectedDuration, courseData);
      
      // Initialize progress (unlock first unit)
      await progressRepository.initializeCourseProgress(courseId, userId);

      console.log(`Course created successfully with ID: ${courseId}`);

      res.json(createdResponse({
        id: courseId,
        language: language,
        title: courseData.course.title,
        totalUnits: courseData.metadata.totalUnits,
        totalLessons: courseData.metadata.totalLessons,
        estimatedTotalTime: courseData.metadata.estimatedTotalTime
      }, 'Course generated successfully!'));
    } catch (error) {
      console.error('Error generating course:', error);
      next(error);
    }
  }

  /**
   * Get learner's courses
   */
  async getLearnerCourses(req, res, next) {
    try {
      const userId = req.user.id;
      const courses = await courseRepository.findLearnerCoursesWithStats(userId);

      const coursesWithDetails = courses.map(course => {
        return {
          id: course.id,
          language: course.language,
          title: course.title || `${course.language} Course`,
          createdAt: course.created_at,
          progress: {
            totalXp: course.total_xp || 0,
            lessonsCompleted: course.lessons_completed || 0,
            unitsCompleted: course.units_completed || 0,
            currentStreak: course.current_streak || 0,
            progressPercentage: course.progress_percentage || 0
          }
        };
      });

      res.json(listResponse(coursesWithDetails, 'Courses retrieved successfully'));
    } catch (error) {
      console.error('Error fetching courses:', error);
      next(error);
    }
  }

  /**
   * Get specific course details with progress
   */
  async getCourseDetails(req, res, next) {
    try {
      const { courseId } = req.params;
      const userId = req.user.id;
      // Get course data
      const course = await courseRepository.findCourseById(courseId, userId);

      if (!course) {
        throw ERRORS.COURSE_NOT_FOUND;
      }
      
      // Parse course data
      let courseData;
      try {
        courseData = course.course_data;
      } catch (parseError) {
        console.error('Error parsing course_data:', parseError);
        throw ERRORS.INVALID_COURSE_DATA;
      }

      // Get unit progress
      const unitProgressResult = await progressRepository.findUnitProgress(userId, courseId);

      // Get lesson progress
      const lessonProgressResult = await progressRepository.findLessonProgress(userId, courseId);

      // Get user stats
      const stats = await progressRepository.findUserStats(userId, courseId);

      // Create progress maps for easy lookup
      const unitProgressMap = {};
      unitProgressResult.forEach(up => {
        unitProgressMap[up.unit_id] = {
          isUnlocked: up.is_unlocked,
          isCompleted: up.is_completed
        };
      });

      const lessonProgressMap = {};
      lessonProgressResult.forEach(lp => {
        const key = `${lp.unit_id}-${lp.lesson_id}`;
        lessonProgressMap[key] = {
          isCompleted: lp.is_completed,
          score: lp.score,
          xpEarned: lp.xp_earned
        };
      });

      // Enhance course data with progress
      const enhancedUnits = courseData.course.units.map(unit => {
        const unitProg = unitProgressMap[unit.id] || { isUnlocked: unit.id === 1, isCompleted: false };
        
        const enhancedLessons = unit.lessons.map((lesson, index) => {
          const key = `${unit.id}-${lesson.id}`;
          const lessonProg = lessonProgressMap[key] || { isCompleted: false, score: 0, xpEarned: 0 };
          
          // Lesson is unlocked if:
          // 1. Unit is unlocked AND
          // 2. It's the first lesson OR previous lesson is completed
          const previousLesson = index > 0 ? unit.lessons[index - 1] : null;
          const previousKey = previousLesson ? `${unit.id}-${previousLesson.id}` : null;
          const previousCompleted = previousKey ? (lessonProgressMap[previousKey]?.isCompleted || false) : true;
          
          return {
            ...lesson,
            isUnlocked: unitProg.isUnlocked && (index === 0 || previousCompleted),
            isCompleted: lessonProg.isCompleted,
            score: lessonProg.score,
            xpEarned: lessonProg.xpEarned
          };
        });

        return {
          ...unit,
          isUnlocked: unitProg.isUnlocked,
          isCompleted: unitProg.isCompleted,
          lessons: enhancedLessons
        };
      });

      res.json(successResponse({
        course: {
          id: course.id,
          language: course.language,
          title: courseData.course.title,
          duration: courseData.course.duration,
          units: enhancedUnits
        },
        stats: stats || {
          total_xp: 0,
          lessons_completed: 0,
          units_completed: 0,
          current_streak: 0,
          longest_streak: 0
        }
      }, 'Course details retrieved successfully'));
    } catch (error) {
      console.error('Error fetching course details:', error);
      next(error);
    }
  }

  /**
   * Get specific lesson details
   */
  async getLessonDetails(req, res, next) {
    try {
      const { courseId, unitId, lessonId } = req.params;
      const userId = req.user.id;
      // Get course data
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

      // Get lesson progress
      const progress = await progressRepository.findSpecificLessonProgress(userId, courseId, unitId, lessonId);

      res.json(successResponse({
        lesson,
        progress: progress || null
      }, 'Lesson details retrieved successfully'));
    } catch (error) {
      console.error('Error fetching lesson details:', error);
      next(error);
    }
  }

  /**
   * Get lesson details (legacy - without unit ID in URL)
   * Searches through all units to find the lesson
   */
  async getLessonDetailsLegacy(req, res, next) {
    try {
      const { courseId, lessonId } = req.params;
      const userId = req.user.id;
      // Get course data
      const courseResult = await courseRepository.findCourseDataById(courseId, userId);

      if (!courseResult) {
        throw ERRORS.COURSE_NOT_FOUND;
      }

      const courseData = courseResult.course_data;
      
      // Search through all units to find the lesson
      let foundLesson = null;
      let foundUnitId = null;

      for (const unit of courseData.course.units) {
        const lesson = unit.lessons.find(l => l.id === parseInt(lessonId));
        if (lesson) {
          foundLesson = lesson;
          foundUnitId = unit.id;
          break;
        }
      }

      if (!foundLesson) {
        throw ERRORS.LESSON_NOT_FOUND;
      }

      // Get lesson progress
      const progress = await progressRepository.findSpecificLessonProgress(userId, courseId, foundUnitId, lessonId);

      res.json(successResponse({
        lesson: foundLesson,
        unitId: foundUnitId,
        progress: progress || null
      }, 'Lesson details retrieved successfully'));
    } catch (error) {
      console.error('Error fetching lesson details (legacy):', error);
      next(error);
    }
  }

  /**
   * Complete lesson (legacy - without unit ID in URL)
   * Finds the unit ID and calls the progress controller
   */
  async completeLessonLegacy(req, res, next) {
    try {
      const { courseId, lessonId } = req.params;
      const userId = req.user.id;
      const { score = 100, exercises = [] } = req.body || {};
      // Get course data to find unit ID
      const courseResult = await courseRepository.findCourseDataById(courseId, userId);

      if (!courseResult) {
        throw ERRORS.COURSE_NOT_FOUND;
      }

      const courseData = courseResult.course_data;
      
      // Find which unit contains this lesson
      let foundUnitId = null;
      let foundLesson = null;

      for (const unit of courseData.course.units) {
        const lesson = unit.lessons.find(l => l.id === parseInt(lessonId));
        if (lesson) {
          foundUnitId = unit.id;
          foundLesson = lesson;
          break;
        }
      }

      if (!foundUnitId || !foundLesson) {
        throw ERRORS.LESSON_NOT_FOUND;
      }

      // Get lesson database ID from course_lessons table
      const lessonDbId = await courseRepository.findLessonDbId(courseId, foundUnitId, lessonId);
      
      if (!lessonDbId) {
        throw ERRORS.LESSON_NOT_FOUND;
      }

      const xpEarned = foundLesson.xpReward || 50;

      // Check if lesson already completed
      const existingProgress = await progressRepository.findSpecificLessonProgress(userId, courseId, foundUnitId, lessonId);

      if (existingProgress && existingProgress.is_completed) {
        throw ERRORS.LESSON_ALREADY_COMPLETED;
      }

      // Mark lesson as complete
      await progressRepository.upsertLessonProgress(userId, courseId, foundUnitId, lessonDbId, score, xpEarned);

      // Save exercise attempts
      for (let i = 0; i < exercises.length; i++) {
        const exercise = exercises[i];
        await progressRepository.createExerciseAttempt(
          userId, courseId, foundUnitId, lessonDbId, i, 
          exercise.isCorrect || false, exercise.userAnswer || ''
        );
      }

      // Check if all lessons in unit are completed
      const unit = courseData.course.units.find(u => u.id === foundUnitId);
      const totalLessonsInUnit = unit.lessons.length;

      const completedLessons = await progressRepository.countCompletedLessonsInUnit(userId, courseId, foundUnitId);
      let unitCompleted = false;

      if (completedLessons >= totalLessonsInUnit) {
        // Mark unit as complete
        await progressRepository.markUnitComplete(userId, courseId, foundUnitId);

        // Unlock next unit
        const nextUnitId = foundUnitId + 1;
        const nextUnit = courseData.course.units.find(u => u.id === nextUnitId);
        
        if (nextUnit) {
          await progressRepository.unlockUnit(userId, courseId, nextUnitId);
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

      console.log(`✅ Lesson ${lessonId} completed! XP: ${xpEarned}, Unit completed: ${unitCompleted}`);

      res.json(successResponse({
        xpEarned,
        unitCompleted,
        nextLessonId: foundLesson.id + 1
      }, unitCompleted ? 'Unit completed! Next unit unlocked!' : 'Lesson completed!'));
    } catch (error) {
      console.error('Error completing lesson (legacy):', error);
      next(error);
    }
  }
}

export default new CourseController();
