/**
 * Middleware for YouTube API requests
 * Handles caching, rate limiting, and quota management
 */
import apiCache from '../utils/apiCache';
import rateLimiter from '../utils/rateLimiter';

/**
 * YouTube API Rate limit configuration
 * - Lower limits than actual YouTube API limits to ensure we stay under quota
 */
const YOUTUBE_RATE_LIMITS = {
  search: {
    maxRequests: 30,    // Max 30 search requests
    windowMs: 60 * 1000 // Per minute
  },
  videos: {
    maxRequests: 50,    // Max 50 video details requests
    windowMs: 60 * 1000 // Per minute
  },
  default: {
    maxRequests: 60,    // Default limit for other API calls
    windowMs: 60 * 1000 // Per minute
  }
};

/**
 * Wrapper for YouTube API requests that handles caching and rate limiting
 * 
 * @param {string} cacheKey - Unique key for caching the response
 * @param {string} rateLimitKey - Key for rate limiting (search, videos, etc.)
 * @param {Function} fetchFunction - Async function that performs the actual API request
 * @returns {Promise<any>} - Cached response or fresh API response
 * @throws {Error} - If rate limit is exceeded
 */
export async function withCacheAndRateLimit(cacheKey, rateLimitKey, fetchFunction) {
  // Check cache first
  const cachedData = apiCache.get(cacheKey);
  if (cachedData) {
    console.log(`[Cache hit] ${cacheKey}`);
    return cachedData;
  }
  
  // Determine appropriate rate limit
  const rateLimit = YOUTUBE_RATE_LIMITS[rateLimitKey] || YOUTUBE_RATE_LIMITS.default;
  
  // Check rate limit before proceeding
  if (!rateLimiter.isAllowed(`youtube_${rateLimitKey}`, rateLimit)) {
    const resetTime = rateLimiter.timeUntilReset(`youtube_${rateLimitKey}`);
    const resetSeconds = Math.ceil(resetTime / 1000);
    
    throw new Error(`YouTube API rate limit reached. Please try again in ${resetSeconds} seconds.`);
  }
  
  // Cache miss and within rate limit, proceed with API request
  console.log(`[Cache miss] ${cacheKey}`);
  
  // Execute the fetch function
  const data = await fetchFunction();
  
  // Store in cache
  apiCache.set(cacheKey, data);
  
  return data;
}

/**
 * Create a standard API response
 * 
 * @param {Object} data - The data to include in the response
 * @param {number} status - HTTP status code
 * @returns {Object} - Structured API response
 */
export function createResponse(data, status = 200) {
  return {
    success: status >= 200 && status < 300,
    data,
    status
  };
}

/**
 * Create an error response
 * 
 * @param {string|Error} error - Error message or Error object
 * @param {number} status - HTTP status code
 * @returns {Object} - Structured error response
 */
export function createErrorResponse(error, status = 500) {
  const message = error instanceof Error ? error.message : error;
  
  return {
    success: false,
    error: message,
    status
  };
}