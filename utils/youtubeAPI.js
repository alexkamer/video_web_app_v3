// YouTube API helper functions
const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3';

/**
 * Search YouTube videos by query with enhanced metadata
 * @param {string} query - The search query
 * @param {number} maxResults - Maximum number of results to return
 * @returns {Promise<Object>} - Search response with video items
 */
export async function searchVideos(query, maxResults = 10) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('YouTube API key not found');
  }

  // First, search for videos
  const searchResponse = await fetch(
    `${YOUTUBE_API_URL}/search?part=snippet&q=${encodeURIComponent(
      query
    )}&maxResults=${maxResults}&type=video&key=${apiKey}`,
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!searchResponse.ok) {
    const error = await searchResponse.json();
    throw new Error(error.error.message || 'Failed to fetch YouTube data');
  }

  const searchData = await searchResponse.json();
  
  // Get videoIds to fetch additional metadata
  const videoIds = searchData.items.map(item => item.id.videoId).join(',');
  
  if (!videoIds) {
    return searchData;
  }
  
  // Get detailed info for these videos including contentDetails, statistics, and topicDetails
  const detailsResponse = await fetch(
    `${YOUTUBE_API_URL}/videos?part=snippet,contentDetails,statistics,topicDetails&id=${videoIds}&key=${apiKey}`,
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!detailsResponse.ok) {
    // If this fails, we can still return the basic search results
    return searchData;
  }

  const detailsData = await detailsResponse.json();
  
  // Merge the detailed data into the search results
  const enhancedItems = searchData.items.map(searchItem => {
    const detailedItem = detailsData.items.find(
      detailItem => detailItem.id === searchItem.id.videoId
    );
    
    if (detailedItem) {
      return {
        ...searchItem,
        contentDetails: detailedItem.contentDetails,
        statistics: detailedItem.statistics,
        topicDetails: detailedItem.topicDetails
      };
    }
    
    return searchItem;
  });

  return {
    ...searchData,
    items: enhancedItems
  };
}

/**
 * Get video details by ID with enhanced metadata
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<Object>} - Video details
 */
export async function getVideoDetails(videoId) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('YouTube API key not found');
  }

  const response = await fetch(
    `${YOUTUBE_API_URL}/videos?part=snippet,contentDetails,statistics,topicDetails&id=${videoId}&key=${apiKey}`,
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error.message || 'Failed to fetch video details');
  }

  const data = await response.json();
  return data.items[0];
}

/**
 * Get related videos for a specific video ID
 * @param {string} videoId - YouTube video ID to find related content for
 * @param {number} maxResults - Maximum number of results to return
 * @returns {Promise<Object>} - Related videos
 */
export async function getRelatedVideos(videoId, maxResults = 10) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('YouTube API key not found');
  }

  const response = await fetch(
    `${YOUTUBE_API_URL}/search?part=snippet&relatedToVideoId=${videoId}&type=video&maxResults=${maxResults}&key=${apiKey}`,
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error.message || 'Failed to fetch related videos');
  }

  const data = await response.json();
  return data;
}