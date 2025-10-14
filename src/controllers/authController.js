import bcrypt from 'bcrypt';
import authRepository from '../repositories/authRepository.js';
import { createAuthToken } from '../utils/jwt.js';
import { authResponse, successResponse } from '../utils/response.js';
import { ERRORS } from '../utils/error.js';

class AuthController {
  /**
   * Signup for learners
   */
  async signupLearner(req, res, next) {
    try {
      const { name, email, password } = req.body;

      if (!name || !email || !password) {
        throw ERRORS.MISSING_REQUIRED_FIELDS;
      }

      // Check if email already exists
      const existingUser = await authRepository.findLearnerByEmail(email);
      if (existingUser) {
        throw ERRORS.EMAIL_ALREADY_EXISTS;
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Start transaction
      await authRepository.beginTransaction();

      try {
        // Create learner
        const learner = await authRepository.createLearner(name, email, passwordHash);

        // Set has_preferences to false for new users
        const user = { ...learner, has_preferences: false };
        const token = createAuthToken({
          id: user.id,
          email: user.email,
          role: 'learner',
          hasPreferences: false
        });

        await authRepository.commitTransaction();

        res.json(authResponse({
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            hasPreferences: false
          },
          token
        }, 'Signup successful'));
      } catch (err) {
        await authRepository.rollbackTransaction();
        throw err;
      }
    } catch (error) {
      console.error('Error in learner signup:', error);
      next(error);
    }
  }

  /**
   * Signup for admins
   */
  async signupAdmin(req, res, next) {
    try {
      const { name, email, password } = req.body;

      if (!name || !email || !password) {
        throw ERRORS.MISSING_REQUIRED_FIELDS;
      }

      // Check if email already exists
      const existingAdmin = await authRepository.findAdminByEmail(email);
      if (existingAdmin) {
        throw ERRORS.EMAIL_ALREADY_EXISTS;
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create admin
      const admin = await authRepository.createAdmin(name, email, passwordHash);

      const token = createAuthToken({
        id: admin.id,
        email: admin.email,
        role: 'admin'
      });

      res.json(authResponse({
        user: {
          id: admin.id,
          name: admin.name,
          email: admin.email
        },
        token
      }, 'Admin signup successful'));
    } catch (error) {
      console.error('Error in admin signup:', error);
      next(error);
    }
  }

  /**
   * Login for learners
   */
  async loginLearner(req, res, next) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        throw ERRORS.MISSING_REQUIRED_FIELDS;
      }

      // Find user
      const user = await authRepository.findLearnerByEmail(email);
      
      if (!user) {
        throw ERRORS.INVALID_CREDENTIALS;
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        throw ERRORS.INVALID_CREDENTIALS;
      }

      // Generate token
      const token = createAuthToken({
        id: user.id,
        email: user.email,
        role: 'learner',
        hasPreferences: user.has_preferences
      });

      res.json(authResponse({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          hasPreferences: user.has_preferences
        },
        token
      }, 'Login successful'));
    } catch (error) {
      console.error('Error in learner login:', error);
      next(error);
    }
  }

  /**
   * Login for admins
   */
  async loginAdmin(req, res, next) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        throw ERRORS.MISSING_REQUIRED_FIELDS;
      }

      // Find admin
      const admin = await authRepository.findAdminByEmail(email);
      
      if (!admin) {
        throw ERRORS.INVALID_CREDENTIALS;
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, admin.password_hash);
      if (!isPasswordValid) {
        throw ERRORS.INVALID_CREDENTIALS;
      }

      // Generate token
      const token = createAuthToken({
        id: admin.id,
        email: admin.email,
        role: 'admin'
      });

      res.json(authResponse({
        user: {
          id: admin.id,
          name: admin.name,
          email: admin.email
        },
        token
      }, 'Admin login successful'));
    } catch (error) {
      console.error('Error in admin login:', error);
      next(error);
    }
  }

  /**
   * Get user profile
   */
  async getProfile(req, res, next) {
    try {
      res.json(successResponse({ user: req.user }, 'Profile retrieved successfully'));
    } catch (error) {
      console.error('Error getting profile:', error);
      next(error);
    }
  }
}

export default new AuthController();
