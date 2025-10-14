const db = require('../config/db');

class AuthRepository {
  /**
   * Find learner by email
   */
  async findLearnerByEmail(email) {
    const result = await db.query(
      `SELECT l.*, 
       EXISTS(SELECT 1 FROM learner_preferences WHERE learner_id = l.id) as has_preferences 
       FROM learners l 
       WHERE l.email = $1`,
      [email]
    );
    return result.rows[0] || null;
  }

  /**
   * Find admin by email
   */
  async findAdminByEmail(email) {
    const result = await db.query(
      'SELECT * FROM admins WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  }

  /**
   * Create learner account
   */
  async createLearner(name, email, passwordHash) {
    const result = await db.query(
      `INSERT INTO learners (name, email, password_hash, created_at, updated_at) 
       VALUES ($1, $2, $3, NOW(), NOW()) 
       RETURNING *`,
      [name, email, passwordHash]
    );
    return result.rows[0];
  }

  /**
   * Create admin account
   */
  async createAdmin(name, email, passwordHash) {
    const result = await db.query(
      'INSERT INTO admins (name, email, password_hash, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING *',
      [name, email, passwordHash]
    );
    return result.rows[0];
  }

  /**
   * Find learner by ID
   */
  async findLearnerById(id) {
    const result = await db.query(
      'SELECT * FROM learners WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find admin by ID
   */
  async findAdminById(id) {
    const result = await db.query(
      'SELECT * FROM admins WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Begin database transaction
   */
  async beginTransaction() {
    await db.query('BEGIN');
  }

  /**
   * Commit database transaction
   */
  async commitTransaction() {
    await db.query('COMMIT');
  }

  /**
   * Rollback database transaction
   */
  async rollbackTransaction() {
    await db.query('ROLLBACK');
  }
}

module.exports = new AuthRepository();
