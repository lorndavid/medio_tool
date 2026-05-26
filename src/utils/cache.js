/**
 * Tiny in-memory cache (zero deps on Redis).
 * Used for hot reads on a single Oracle free instance.
 */
const NodeCache = require('node-cache');

const cache = new NodeCache({
  stdTTL: 60,         // default 60s
  checkperiod: 120,
  useClones: false,
  maxKeys: 5000,
});

module.exports = cache;
