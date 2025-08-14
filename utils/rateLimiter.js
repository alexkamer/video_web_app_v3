/**
 * Simple rate limiter for API requests
 * Prevents excessive calls to external APIs
 */

// Rate limit windows and counters
const requestCounts = new Map();

// Configuration
const DEFAULT_WINDOW = 60 * 1000; // 1 minute window
const DEFAULT_MAX_REQUESTS = 60;  // 60 requests per minute

/**
 * Check if a request is allowed under rate limits
 * 
 * @param {string} key - Identifier for the rate limit (e.g., 'youtube_api')
 * @param {Object} options - Rate limit options
 * @param {number} options.maxRequests - Maximum requests allowed in window
 * @param {number} options.windowMs - Time window in milliseconds
 * @returns {boolean} - Whether the request is allowed
 */
function isAllowed(key, { maxRequests = DEFAULT_MAX_REQUESTS, windowMs = DEFAULT_WINDOW } = {}) {
  const now = Date.now();
  
  // Initialize or clean up old entries for this key
  if (!requestCounts.has(key)) {
    requestCounts.set(key, {
      count: 0,
      resetAt: now + windowMs,
      windowMs
    });
  }
  
  const entry = requestCounts.get(key);
  
  // Reset if window has expired
  if (now >= entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + entry.windowMs;
  }
  
  // Check if under limit
  if (entry.count < maxRequests) {
    entry.count++;
    return true;
  }
  
  return false;
}

/**
 * Get the time until rate limit resets
 * 
 * @param {string} key - Identifier for the rate limit
 * @returns {number} - Milliseconds until reset (0 if not limited or key not found)
 */
function timeUntilReset(key) {
  if (!requestCounts.has(key)) {
    return 0;
  }
  
  const { resetAt } = requestCounts.get(key);
  const now = Date.now();
  
  return Math.max(0, resetAt - now);
}

/**
 * Get rate limit status
 * 
 * @param {string} key - Identifier for the rate limit
 * @returns {Object|null} - Rate limit status or null if key not found
 */
function getStatus(key) {
  if (!requestCounts.has(key)) {
    return null;
  }
  
  const { count, resetAt, windowMs } = requestCounts.get(key);
  const now = Date.now();
  
  return {
    used: count,
    remaining: Math.max(0, DEFAULT_MAX_REQUESTS - count),
    resetIn: Math.max(0, resetAt - now),
    windowMs
  };
}

module.exports = {
  isAllowed,
  timeUntilReset,
  getStatus
};