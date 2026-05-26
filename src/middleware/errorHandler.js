const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

function notFound(req, res, next) {
  if (req.accepts('html')) return res.status(404).render('admin/error', { code: 404, message: 'Not found' });
  res.status(404).json({ error: 'NOT_FOUND' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  if (status >= 500) logger.error('Unhandled error', { err: err.message, stack: err.stack });
  else logger.warn('Handled error', { err: err.message });

  if (req.accepts('html')) {
    return res.status(status).render('admin/error', { code: status, message: err.message || 'Error' });
  }
  res.status(status).json({
    error: err.code || 'ERROR',
    message: err.message || 'Error',
    ...(err instanceof AppError && err.details ? { details: err.details } : {}),
  });
}

module.exports = { notFound, errorHandler };
