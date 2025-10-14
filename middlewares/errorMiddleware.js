const { RequestError } = require('../utils/error');
const { errorResponse } = require('../utils/response');

// Global error handler
const errorHandler = (error, req, res, next) => {
  // Log error with structured logging
  console.error(`Error occurred: ${error.message}`, {
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query,
    timestamp: new Date().toISOString(),
  });

  // Handle RequestError (our custom errors)
  if (error instanceof RequestError) {
    return res.status(error.statusCode).json(
      errorResponse(error.message, error.code)
    );
  }

  // Handle JWT specific errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json(
      errorResponse('Invalid authentication token', 20002)
    );
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json(
      errorResponse('Authentication token has expired', 20003)
    );
  }

  // Handle PostgreSQL/Database errors
  if (error.code === '23505') { // Unique violation
    return res.status(409).json(
      errorResponse('Duplicate entry detected', 10009)
    );
  }

  if (error.code === '23503') { // Foreign key violation
    return res.status(400).json(
      errorResponse('Referenced record not found', 10001)
    );
  }

  if (error.code === '23502') { // Not null violation
    return res.status(400).json(
      errorResponse('Required field is missing', 10011)
    );
  }

  if (error.code === '22P02') { // Invalid text representation
    return res.status(400).json(
      errorResponse('Invalid data format', 10002)
    );
  }

  // Handle validation errors (if using express-validator)
  if (error.name === 'ValidationError') {
    return res.status(422).json(
      errorResponse(error.message, 10008)
    );
  }

  // Handle syntax errors in JSON
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json(
      errorResponse('Invalid JSON in request body', 10012)
    );
  }

  // Handle any other unexpected errors
  const isDevelopment = process.env.NODE_ENV !== 'production';
  return res.status(500).json(
    errorResponse(
      isDevelopment ? error.message : 'Internal server error',
      10005
    )
  );
};

// 404 Not Found handler
const notFoundHandler = (req, res) => {
  res.status(404).json(
    errorResponse(`Route ${req.method} ${req.path} not found`, 10006)
  );
};

module.exports = {
  errorHandler,
  notFoundHandler
};
