/**
 * Smart video summary cache that tracks user activity
 * Caches summaries for 10 minutes or until user leaves the watch page
 */

// Cache storage with activity tracking
const summaryCache = new Map();
const userActivity = new Map();

// 10 minutes in milliseconds
const CACHE_DURATION = 10 * 60 * 1000;

/**
 * Get cached summary for a video
 * 
 * @param {string} videoId - YouTube video ID
 * @returns {any|null} - Cached summary or null if not found/expired
 */
function getSummary(videoId) {
  if (!summaryCache.has(videoId)) return null;
  
  const { summary, timestamp } = summaryCache.get(videoId);
  const now = Date.now();
  
  // Check if cache has expired (10 minutes)
  if (now - timestamp > CACHE_DURATION) {
    summaryCache.delete(videoId);
    userActivity.delete(videoId);
    return null;
  }
  
  // Update last activity time
  userActivity.set(videoId, now);
  
  return summary;
}

/**
 * Set summary in cache
 * 
 * @param {string} videoId - YouTube video ID
 * @param {any} summary - Summary to cache
 */
function setSummary(videoId, summary) {
  const now = Date.now();
  summaryCache.set(videoId, { summary, timestamp: now });
  userActivity.set(videoId, now);
}

/**
 * Mark user as active on a video (called when user is on watch page)
 * 
 * @param {string} videoId - YouTube video ID
 */
function markUserActive(videoId) {
  userActivity.set(videoId, Date.now());
}

/**
 * Mark user as inactive on a video (called when user leaves watch page)
 * 
 * @param {string} videoId - YouTube video ID
 */
function markUserInactive(videoId) {
  userActivity.delete(videoId);
  summaryCache.delete(videoId);
}

/**
 * Check if user is currently active on a video
 * 
 * @param {string} videoId - YouTube video ID
 * @returns {boolean} - True if user is active
 */
function isUserActive(videoId) {
  return userActivity.has(videoId);
}

/**
 * Get cache stats
 * 
 * @returns {Object} - Cache statistics
 */
function getStats() {
  const now = Date.now();
  let activeCount = 0;
  let expiredCount = 0;
  
  summaryCache.forEach(({ timestamp }, videoId) => {
    if (now - timestamp <= CACHE_DURATION && userActivity.has(videoId)) {
      activeCount++;
    } else {
      expiredCount++;
    }
  });
  
  return {
    totalEntries: summaryCache.size,
    activeEntries: activeCount,
    expiredEntries: expiredCount,
    activeUsers: userActivity.size
  };
}

/**
 * Clean expired entries from cache
 */
function cleanExpired() {
  const now = Date.now();
  
  for (const [videoId, { timestamp }] of summaryCache.entries()) {
    // Remove if expired OR user is no longer active
    if (now - timestamp > CACHE_DURATION || !userActivity.has(videoId)) {
      summaryCache.delete(videoId);
      userActivity.delete(videoId);
    }
  }
}

// Run cleanup every 5 minutes
const cleanupInterval = setInterval(cleanExpired, 5 * 60 * 1000);

// Ensure cleanup interval is cleared when Node.js process exits
if (typeof process !== 'undefined') {
  process.on('exit', () => {
    clearInterval(cleanupInterval);
  });
}

export default {
  getSummary,
  setSummary,
  markUserActive,
  markUserInactive,
  isUserActive,
  getStats,
  cleanExpired
};
