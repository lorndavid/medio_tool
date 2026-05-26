/**
 * Wraps an async route handler so thrown errors flow to express error middleware.
 */
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
