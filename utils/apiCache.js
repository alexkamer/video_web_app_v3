/**
 * Simple in-memory cache for API responses
 * This reduces YouTube API quota usage by caching results
 */

// Cache storage with TTL (time to live)
const cache = new Map();

// Default TTL is 6 hours (in milliseconds)
const DEFAULT_TTL = 6 * 60 * 60 * 1000;

/**
 * Get item from cache
 * 
 * @param {string} key - Cache key
 * @returns {any|null} - Cached item or null if not found/expired
 */
function get(key) {
  if (!cache.has(key)) return null;
  
  const { value, expiry } = cache.get(key);
  
  // Check if entry has expired
  if (expiry < Date.now()) {
    cache.delete(key);
    return null;
  }
  
  return value;
}

/**
 * Set item in cache with TTL
 * 
 * @param {string} key - Cache key 
 * @param {any} value - Value to cache
 * @param {number} ttl - Time to live in milliseconds
 */
function set(key, value, ttl = DEFAULT_TTL) {
  const expiry = Date.now() + ttl;
  cache.set(key, { value, expiry });
}

/**
 * Clear all items from cache or remove specific key
 * 
 * @param {string} [key] - Optional key to clear
 */
function clear(key) {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

/**
 * Get cache stats
 * 
 * @returns {Object} - Cache statistics
 */
function getStats() {
  // Count active (non-expired) entries
  let activeCount = 0;
  let expiredCount = 0;
  const now = Date.now();
  
  cache.forEach(({ expiry }) => {
    if (expiry > now) {
      activeCount++;
    } else {
      expiredCount++;
    }
  });
  
  return {
    totalEntries: cache.size,
    activeEntries: activeCount,
    expiredEntries: expiredCount
  };
}

/**
 * Clean expired entries from cache
 */
function cleanExpired() {
  const now = Date.now();
  
  for (const [key, { expiry }] of cache.entries()) {
    if (expiry < now) {
      cache.delete(key);
    }
  }
}

// Run cleanup every hour
const cleanupInterval = setInterval(cleanExpired, 60 * 60 * 1000);

// Ensure cleanup interval is cleared when Node.js process exits
if (typeof process !== 'undefined') {
  process.on('exit', () => {
    clearInterval(cleanupInterval);
  });
  
  // Handle signals
  ['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(signal => {
    process.on(signal, () => {
      clearInterval(cleanupInterval);
      process.exit();
    });
  });
}

module.exports = {
  get,
  set,
  clear,
  getStats,
  cleanExpired
};