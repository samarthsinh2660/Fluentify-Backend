import bcrypt from 'bcrypt';
import userManagementRepository from '../repositories/userManagementRepository.js';
import { successResponse, listResponse, updatedResponse, deletedResponse } from '../utils/response.js';
import { ERRORS } from '../utils/error.js';

/**
 * User Management Controller
 * Admin operations for managing learner users
 */
class UserManagementController {
  /**
   * Get all learners with pagination and search
   */
  async getAllLearners(req, res, next) {
    try {
      const { page = 1, limit = 10, search = '' } = req.query;
      
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      
      if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
        throw ERRORS.INVALID_QUERY_PARAMETER;
      }
      
      const result = await userManagementRepository.getAllLearners(pageNum, limitNum, search);
      
      res.json(listResponse(
        result.learners,
        'Learners retrieved successfully',
        result.pagination
      ));
    } catch (error) {
      console.error('Error fetching learners:', error);
      next(error);
    }
  }

  /**
   * Get learner by ID with detailed information
   */
  async getLearnerById(req, res, next) {
    try {
      const { learnerId } = req.params;
      
      const learner = await userManagementRepository.getLearnerById(learnerId);
      
      if (!learner) {
        throw ERRORS.USER_NOT_FOUND;
      }
      
      res.json(successResponse(learner, 'Learner details retrieved successfully'));
    } catch (error) {
      console.error('Error fetching learner details:', error);
      next(error);
    }
  }

  /**
   * Update learner details (name, email)
   */
  async updateLearner(req, res, next) {
    try {
      const { learnerId } = req.params;
      const { name, email } = req.body;
      
      if (!name || !email) {
        throw ERRORS.MISSING_REQUIRED_FIELDS;
      }
      
      // Check if learner exists
      const existingLearner = await userManagementRepository.getLearnerById(learnerId);
      if (!existingLearner) {
        throw ERRORS.USER_NOT_FOUND;
      }
      
      // Check if email is already taken by another user
      const emailExists = await userManagementRepository.checkEmailExists(email, learnerId);
      if (emailExists) {
        throw ERRORS.EMAIL_ALREADY_EXISTS;
      }
      
      const updatedLearner = await userManagementRepository.updateLearner(learnerId, name, email);
      
      res.json(updatedResponse(updatedLearner, 'Learner updated successfully'));
    } catch (error) {
      console.error('Error updating learner:', error);
      next(error);
    }
  }

  /**
   * Update learner password
   */
  async updateLearnerPassword(req, res, next) {
    try {
      const { learnerId } = req.params;
      const { password } = req.body;
      
      if (!password || password.length < 6) {
        throw ERRORS.VALIDATION_ERROR;
      }
      
      // Check if learner exists
      const existingLearner = await userManagementRepository.getLearnerById(learnerId);
      if (!existingLearner) {
        throw ERRORS.USER_NOT_FOUND;
      }
      
      // Hash new password
      const passwordHash = await bcrypt.hash(password, 10);
      
      await userManagementRepository.updateLearnerPassword(learnerId, passwordHash);
      
      res.json(successResponse(
        { learnerId: parseInt(learnerId) },
        'Password updated successfully'
      ));
    } catch (error) {
      console.error('Error updating password:', error);
      next(error);
    }
  }

  /**
   * Delete learner and all related data
   */
  async deleteLearner(req, res, next) {
    try {
      const { learnerId } = req.params;
      
      console.log(`🗑️  Admin deleting learner ${learnerId}...`);
      
      // Check if learner exists
      const existingLearner = await userManagementRepository.getLearnerById(learnerId);
      if (!existingLearner) {
        throw ERRORS.USER_NOT_FOUND;
      }
      
      await userManagementRepository.deleteLearner(learnerId);
      
      console.log(`✅ Learner ${learnerId} deleted successfully by admin`);
      
      res.json(deletedResponse('Learner and all related data deleted successfully'));
    } catch (error) {
      console.error('Error deleting learner:', error);
      next(error);
    }
  }

  /**
   * Get learner's courses
   */
  async getLearnerCourses(req, res, next) {
    try {
      const { learnerId } = req.params;
      
      // Check if learner exists
      const existingLearner = await userManagementRepository.getLearnerById(learnerId);
      if (!existingLearner) {
        throw ERRORS.USER_NOT_FOUND;
      }
      
      const courses = await userManagementRepository.getLearnerCourses(learnerId);
      
      res.json(listResponse(courses, 'Learner courses retrieved successfully'));
    } catch (error) {
      console.error('Error fetching learner courses:', error);
      next(error);
    }
  }
}

export default new UserManagementController();
