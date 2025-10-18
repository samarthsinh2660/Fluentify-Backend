import jwt from 'jsonwebtoken';
import { ERRORS } from '../utils/error.js';

const JWT_SECRET = process.env.JWT_SECRET;

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return next(ERRORS.NO_TOKEN_PROVIDED);
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return next(ERRORS.TOKEN_EXPIRED);
      }
      return next(ERRORS.INVALID_AUTH_TOKEN);
    }
    req.user = user;
    next();
  });
}

/**
 * Middleware to check if authenticated user is an admin
 * Must be used AFTER authMiddleware
 */
function adminMiddleware(req, res, next) {
  if (!req.user) {
    return next(ERRORS.UNAUTHORIZED);
  }

  if (req.user.role !== 'admin') {
    return next(ERRORS.ADMIN_ONLY_ROUTE);
  }

  next();
}

export default authMiddleware;
export { adminMiddleware };
