const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const expressLayouts = require('express-ejs-layouts');

const env = require('./config/env');
const logger = require('./utils/logger');
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');
const { notFound, errorHandler } = require('./middleware/errorHandler');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.set('views', path.join(__dirname, 'views'));
  app.set('view engine', 'ejs');
  app.use(expressLayouts);
  app.set('layout', 'admin/layout');

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'script-src': ["'self'", 'https://cdn.jsdelivr.net', "'unsafe-inline'"],
          'style-src': ["'self'", 'https://fonts.googleapis.com', "'unsafe-inline'"],
          'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
          'img-src': ["'self'", 'data:', 'https:'],
          'connect-src': ["'self'", 'https://cdn.jsdelivr.net'],
        },
      },
    })
  );

  app.use(compression());
  app.use(cors({ origin: false }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser(env.cookieSecret));
  app.use(morgan(env.isProd ? 'combined' : 'dev', { stream: { write: (m) => logger.http?.(m.trim()) || logger.info(m.trim()) } }));

  app.use(express.static(path.join(__dirname, '..', 'public')));

  // public api rate limit
  const limiter = rateLimit({
    windowMs: env.rateLimit.windowMs,
    max: env.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api', limiter);

  app.get('/healthz', (req, res) => res.json({ ok: true, ts: Date.now() }));

  app.use('/api', apiRoutes);
  app.use('/admin', adminRoutes);

  app.get('/', (req, res) => res.redirect('/admin'));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
