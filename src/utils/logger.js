const path = require('path');
const fs = require('fs');
const winston = require('winston');
require('winston-daily-rotate-file');

const logsDir = path.resolve(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const level = process.env.LOG_LEVEL || 'info';

const fileTransport = new winston.transports.DailyRotateFile({
  dirname: logsDir,
  filename: 'mediaflow-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
});

const errorTransport = new winston.transports.DailyRotateFile({
  dirname: logsDir,
  filename: 'error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d',
});

const logger = winston.createLogger({
  level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'mediaflow-bot' },
  transports: [
    fileTransport,
    errorTransport,
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level: lvl, message, timestamp, stack }) => {
          return `${timestamp} ${lvl}: ${stack || message}`;
        })
      ),
    }),
  ],
});

module.exports = logger;
