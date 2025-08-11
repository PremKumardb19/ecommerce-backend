/**
 * Middleware to catch all unmatched routes (404 Not Found)
 */
function notFoundHandler(req, res, next) {
  res.status(404).json({ error: 'Resource not found' });
}

/**
 * Global error handling middleware
 * Catches errors, logs them, and sends user-friendly responses
 */
function errorHandler(err, req, res, next) {
  // Log the error stack trace for debugging
  console.error(err);

  // Use error.statusCode if set, otherwise fallback to 500
  const statusCode = err.statusCode || 500;

  // Use error message if available, else generic message
  const message = err.message || 'Internal Server Error';

  // Send JSON response with error details
  res.status(statusCode).json({
    error: message,
    // Include stack trace only in development for security
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
