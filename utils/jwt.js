const jwt = require('jsonwebtoken');
const { ERRORS } = require('./error');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '2h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

/**
 * Create authentication token
 * @param {Object} user - User data to encode in token
 * @param {number} user.id - User ID
 * @param {string} user.email - User email
 * @param {string} user.role - User role (learner/admin)
 * @param {boolean} [user.hasPreferences] - Whether user has set preferences
 * @returns {string} JWT token
 */
function createAuthToken(user) {
  if (!JWT_SECRET) {
    throw ERRORS.INTERNAL_SERVER_ERROR;
  }
  
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    hasPreferences: user.hasPreferences || false
  };
  
  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });
  
  return token;
}

/**
 * Create refresh token
 * @param {Object} user - User data to encode in token
 * @returns {string} JWT refresh token
 */
function createRefreshToken(user) {
  if (!JWT_SECRET) {
    throw ERRORS.INTERNAL_SERVER_ERROR;
  }
  
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role
  };
  
  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN
  });
  
  return token;
}

/**
 * Decode and verify authentication token
 * @param {string} token - JWT token to decode
 * @returns {Object} Decoded token data
 */
function decodeAuthToken(token) {
  if (!JWT_SECRET) {
    throw ERRORS.INTERNAL_SERVER_ERROR;
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (typeof decoded === 'string') {
      throw ERRORS.INVALID_AUTH_TOKEN;
    }
    
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw ERRORS.TOKEN_EXPIRED;
    }
    if (error.name === 'JsonWebTokenError') {
      throw ERRORS.INVALID_AUTH_TOKEN;
    }
    throw error;
  }
}

/**
 * Decode and verify refresh token
 * @param {string} token - JWT refresh token to decode
 * @returns {Object} Decoded token data
 */
function decodeRefreshToken(token) {
  if (!JWT_SECRET) {
    throw ERRORS.INTERNAL_SERVER_ERROR;
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (typeof decoded === 'string') {
      throw ERRORS.INVALID_AUTH_TOKEN;
    }
    
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw ERRORS.TOKEN_EXPIRED;
    }
    throw ERRORS.INVALID_AUTH_TOKEN;
  }
}

module.exports = {
  createAuthToken,
  createRefreshToken,
  decodeAuthToken,
  decodeRefreshToken
};
