const logger = require('../utils/logger');
const env = require('../config/env');

// Thrown anywhere in the stack; the handler below turns it into a clean JSON
// response. Anything that is NOT an ApiError is treated as a real bug and
// reported as a 500 without leaking internals to the client.
class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
  static badRequest(msg, details) { return new ApiError(400, msg, details); }
  static unauthorized(msg = 'Not authenticated') { return new ApiError(401, msg); }
  static forbidden(msg = 'Not allowed') { return new ApiError(403, msg); }
  static notFound(msg = 'Not found') { return new ApiError(404, msg); }
  static conflict(msg, details) { return new ApiError(409, msg, details); }
}

// Wraps an async handler so a rejected promise reaches Express instead of
// hanging the request. Every async controller is wrapped in this.
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

function notFoundHandler(req, res) {
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars -- Express needs the 4-arg signature
function errorHandler(err, req, res, next) {
  const status = err.status || 500;

  if (status >= 500) {
    logger.error(`${req.method} ${req.originalUrl} failed`, {
      message: err.message,
      stack: err.stack,
    });
  } else {
    logger.warn(`${req.method} ${req.originalUrl} -> ${status}`, err.message);
  }

  const body = {
    error: status >= 500 ? 'Internal server error' : err.message,
  };
  if (err.details) body.details = err.details;
  // Stack only in dev - useful during the build, noise (and a leak) in prod.
  if (status >= 500 && !env.isProd) body.stack = err.stack;

  res.status(status).json(body);
}

module.exports = { ApiError, asyncHandler, notFoundHandler, errorHandler };
