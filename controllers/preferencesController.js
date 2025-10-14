const preferencesRepository = require('../repositories/preferencesRepository');
const { createdResponse, listResponse } = require('../utils/response');
const { ERRORS } = require('../utils/error');

class PreferencesController {
  /**
   * Save learner preferences
   */
  async savePreferences(req, res, next) {
    try {
      const { language, expected_duration } = req.body;
      const { id, role } = req.user;

      // Check if user is learner
      if (role !== 'learner') {
        throw ERRORS.LEARNER_ONLY_ROUTE;
      }

      // Validate input
      if (!language || !expected_duration) {
        throw ERRORS.MISSING_REQUIRED_FIELDS;
      }

      // Save preferences
      await preferencesRepository.createPreferences(id, language, expected_duration);

      res.json(createdResponse({
        language,
        expected_duration
      }, 'Preferences saved successfully'));
    } catch (error) {
      console.error('Error saving preferences:', error);
      next(error);
    }
  }

  /**
   * Get learner preferences
   */
  async getPreferences(req, res, next) {
    try {
      const { id, role } = req.user;

      // Check if user is learner
      if (role !== 'learner') {
        throw ERRORS.LEARNER_ONLY_ROUTE;
      }

      // Get preferences
      const preferences = await preferencesRepository.findByLearnerId(id);

      res.json(listResponse(preferences, 'Preferences retrieved successfully'));
    } catch (error) {
      console.error('Error fetching preferences:', error);
      next(error);
    }
  }

  /**
   * Update learner preferences
   */
  async updatePreferences(req, res, next) {
    try {
      const { language, expected_duration } = req.body;
      const { id, role } = req.user;

      // Check if user is learner
      if (role !== 'learner') {
        throw ERRORS.LEARNER_ONLY_ROUTE;
      }

      // Validate input
      if (!language || !expected_duration) {
        throw ERRORS.MISSING_REQUIRED_FIELDS;
      }

      // Update preferences
      await preferencesRepository.updatePreferences(id, language, expected_duration);

      const { updatedResponse } = require('../utils/response');
      res.json(updatedResponse({
        language,
        expected_duration
      }, 'Preferences updated successfully'));
    } catch (error) {
      console.error('Error updating preferences:', error);
      next(error);
    }
  }

  /**
   * Delete learner preferences
   */
  async deletePreferences(req, res, next) {
    try {
      const { id, role } = req.user;

      // Check if user is learner
      if (role !== 'learner') {
        throw ERRORS.LEARNER_ONLY_ROUTE;
      }

      // Delete preferences
      await preferencesRepository.deletePreferences(id);

      const { deletedResponse } = require('../utils/response');
      res.json(deletedResponse('Preferences deleted successfully'));
    } catch (error) {
      console.error('Error deleting preferences:', error);
      next(error);
    }
  }
}

module.exports = new PreferencesController();
