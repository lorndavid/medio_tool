/**
 * Centralized, validated environment loader.
 * Fails fast if a required variable is missing.
 */
const path = require('path');
const dotenv = require('dotenv');
const Joi = require('joi');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  APP_NAME: Joi.string().default('MediaFlow Bot'),
  PUBLIC_URL: Joi.string().uri().default('http://localhost:3000'),

  TELEGRAM_TOKEN: Joi.string().required(),
  TELEGRAM_WEBHOOK_DOMAIN: Joi.string().allow('').default(''),

  MONGO_URI: Joi.string().required(),

  REDIS_ENABLED: Joi.boolean().truthy('true').falsy('false').default(false),
  REDIS_HOST: Joi.string().default('127.0.0.1'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),

  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string().default('7d'),
  COOKIE_SECRET: Joi.string().min(16).required(),

  // tlds:false — accept any well-formed email (including .local / internal TLDs).
  ADMIN_EMAIL: Joi.string().email({ tlds: false }).default('admin@mediaflow.local'),
  ADMIN_PASSWORD: Joi.string().min(6).default('ChangeMe!2026'),
  ADMIN_NAME: Joi.string().default('Super Admin'),

  RATE_LIMIT_WINDOW_MS: Joi.number().default(60000),
  RATE_LIMIT_MAX: Joi.number().default(120),

  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'http', 'debug').default('info'),

  TIKWM_API: Joi.string().uri().default('https://tikwm.com/api/'),
}).unknown(true);

const { value, error } = schema.validate(process.env, { abortEarly: false });
if (error) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment configuration:\n' + error.details.map((d) => ' - ' + d.message).join('\n'));
  process.exit(1);
}

module.exports = Object.freeze({
  nodeEnv: value.NODE_ENV,
  isProd: value.NODE_ENV === 'production',
  port: value.PORT,
  appName: value.APP_NAME,
  publicUrl: value.PUBLIC_URL,

  telegram: {
    token: value.TELEGRAM_TOKEN,
    webhookDomain: value.TELEGRAM_WEBHOOK_DOMAIN,
  },

  mongoUri: value.MONGO_URI,

  redis: {
    enabled: value.REDIS_ENABLED,
    host: value.REDIS_HOST,
    port: value.REDIS_PORT,
    password: value.REDIS_PASSWORD || undefined,
  },

  jwt: {
    secret: value.JWT_SECRET,
    expiresIn: value.JWT_EXPIRES_IN,
  },
  cookieSecret: value.COOKIE_SECRET,

  admin: {
    email: value.ADMIN_EMAIL,
    password: value.ADMIN_PASSWORD,
    name: value.ADMIN_NAME,
  },

  rateLimit: {
    windowMs: value.RATE_LIMIT_WINDOW_MS,
    max: value.RATE_LIMIT_MAX,
  },

  logLevel: value.LOG_LEVEL,
  tikwmApi: value.TIKWM_API,
});
