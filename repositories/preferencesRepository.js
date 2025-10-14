const db = require('../config/db');

class PreferencesRepository {
  /**
   * Find learner preferences by learner ID
   */
  async findByLearnerId(learnerId) {
    const result = await db.query(
      'SELECT * FROM learner_preferences WHERE learner_id = $1',
      [learnerId]
    );
    return result.rows;
  }

  /**
   * Create learner preferences
   */
  async createPreferences(learnerId, language, expectedDuration) {
    await db.query(
      'INSERT INTO learner_preferences (learner_id, language, expected_duration) VALUES ($1, $2, $3)',
      [learnerId, language, expectedDuration]
    );
  }

  /**
   * Update learner preferences
   */
  async updatePreferences(learnerId, language, expectedDuration) {
    await db.query(
      'UPDATE learner_preferences SET language = $2, expected_duration = $3, updated_at = NOW() WHERE learner_id = $1',
      [learnerId, language, expectedDuration]
    );
  }

  /**
   * Delete learner preferences
   */
  async deletePreferences(learnerId) {
    await db.query(
      'DELETE FROM learner_preferences WHERE learner_id = $1',
      [learnerId]
    );
  }

  /**
   * Check if preferences exist for learner
   */
  async preferencesExist(learnerId) {
    const result = await db.query(
      'SELECT EXISTS(SELECT 1 FROM learner_preferences WHERE learner_id = $1) as exists',
      [learnerId]
    );
    return result.rows[0].exists;
  }
}

module.exports = new PreferencesRepository();
