const jwt = require('jsonwebtoken');
const { ERRORS } = require('../utils/error');
const JWT_SECRET = process.env.JWT_SECRET;

module.exports = function (req, res, next) {
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
};
