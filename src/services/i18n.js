const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const LOCALES_DIR = path.join(__dirname, '..', 'locales');

const SUPPORTED = ['en', 'km', 'pl', 'ko'];
const DEFAULT_LANG = 'en';

const dictionaries = {};

function load() {
  for (const code of SUPPORTED) {
    const p = path.join(LOCALES_DIR, `${code}.json`);
    try {
      dictionaries[code] = JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) {
      logger.error(`Failed to load locale ${code}`, { err: e.message });
      dictionaries[code] = {};
    }
  }
}
load();

function pickLang(code) {
  if (!code) return DEFAULT_LANG;
  const short = String(code).toLowerCase().slice(0, 2);
  return SUPPORTED.includes(short) ? short : DEFAULT_LANG;
}

function getByPath(obj, dotted) {
  return dotted.split('.').reduce((acc, k) => (acc && acc[k] != null ? acc[k] : undefined), obj);
}

function format(template, vars = {}) {
  if (typeof template !== 'string') return template;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => (vars[key] != null ? vars[key] : ''));
}

/**
 * t('welcome', { name: 'Alice' }, 'km')
 */
function t(key, vars = {}, lang = DEFAULT_LANG) {
  const code = pickLang(lang);
  const dict = dictionaries[code] || dictionaries[DEFAULT_LANG];
  const fallback = dictionaries[DEFAULT_LANG];
  const value = getByPath(dict, key) ?? getByPath(fallback, key) ?? key;
  return format(value, vars);
}

module.exports = { t, SUPPORTED, DEFAULT_LANG, pickLang };
