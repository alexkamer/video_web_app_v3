/**
 * Utility functions for video recommendations based on metadata
 */

/**
 * Calculates the similarity score between two videos
 * Higher score means more similar
 * 
 * @param {Object} video1 - First video object with metadata
 * @param {Object} video2 - Second video object with metadata
 * @returns {number} Similarity score (0-100)
 */
export function calculateSimilarityScore(video1, video2) {
  let score = 0;
  const maxScore = 100;
  
  // If videos are the same, they're 100% similar
  if (video1.id === video2.id || 
      (video1.id?.videoId && video1.id.videoId === video2.id.videoId)) {
    return maxScore;
  }

  // Check if they're from the same channel (high similarity)
  if (video1.snippet?.channelId === video2.snippet?.channelId) {
    score += 30;
  }

  // Check if they have the same category
  const category1 = video1.categoryId || video1.snippet?.categoryId;
  const category2 = video2.categoryId || video2.snippet?.categoryId;
  
  if (category1 && category2 && category1 === category2) {
    score += 25;
  }

  // Compare tags (if available)
  const tags1 = video1.tags || video1.snippet?.tags || [];
  const tags2 = video2.tags || video2.snippet?.tags || [];
  
  if (tags1.length > 0 && tags2.length > 0) {
    // Count how many tags they have in common
    const commonTags = tags1.filter(tag => tags2.includes(tag));
    // Add up to 25 points based on the percentage of common tags
    const tagScore = Math.min(25, Math.floor((commonTags.length / Math.min(tags1.length, tags2.length)) * 25));
    score += tagScore;
  }

  // Compare titles for common keywords
  const title1 = video1.snippet?.title || '';
  const title2 = video2.snippet?.title || '';
  
  // Extract keywords (simple approach: split by spaces and remove short words)
  const keywords1 = title1.toLowerCase().split(' ').filter(word => word.length > 3);
  const keywords2 = title2.toLowerCase().split(' ').filter(word => word.length > 3);
  
  if (keywords1.length > 0 && keywords2.length > 0) {
    const commonKeywords = keywords1.filter(word => keywords2.includes(word));
    // Add up to 20 points based on common keywords
    const keywordScore = Math.min(20, Math.floor((commonKeywords.length / Math.min(keywords1.length, keywords2.length)) * 20));
    score += keywordScore;
  }

  return score;
}

/**
 * Get recommended videos based on similarity to a reference video
 * 
 * @param {Object} referenceVideo - The video to base recommendations on
 * @param {Array} videoPool - Pool of videos to search for recommendations
 * @param {number} limit - Maximum number of recommendations to return
 * @returns {Array} Sorted array of recommended videos with similarity scores
 */
export function getRecommendedVideos(referenceVideo, videoPool, limit = 5) {
  if (!referenceVideo || !videoPool || videoPool.length === 0) {
    return [];
  }
  
  // Calculate similarity scores for all videos in the pool
  const scoredVideos = videoPool.map(video => {
    return {
      video,
      score: calculateSimilarityScore(referenceVideo, video)
    };
  });
  
  // Sort by score (highest first) and exclude the reference video itself
  const referenceId = referenceVideo.id?.videoId || referenceVideo.id;
  
  const recommendations = scoredVideos
    .filter(item => {
      const itemId = item.video.id?.videoId || item.video.id;
      return itemId !== referenceId;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  
  return recommendations;
}

/**
 * Group videos by category for better discovery
 * 
 * @param {Array} videos - Array of video objects
 * @returns {Object} Object with categories as keys and video arrays as values
 */
export function groupVideosByCategory(videos) {
  if (!videos || videos.length === 0) {
    return {};
  }
  
  const categories = {};
  
  videos.forEach(video => {
    const categoryId = video.categoryId || video.snippet?.categoryId;
    
    if (categoryId) {
      if (!categories[categoryId]) {
        categories[categoryId] = [];
      }
      categories[categoryId].push(video);
    }
  });
  
  return categories;
}