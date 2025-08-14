import apiCache from '../../../utils/apiCache';
import rateLimiter from '../../../utils/rateLimiter';

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { query, pageToken, contentType = 'all', duration = 'any', caption = 'any', quality = 'any', uploadDate = 'any', sortOrder = 'relevance' } = req.query;
    
    // Check rate limits before proceeding
    const rateLimitKey = 'youtube_search';
    if (!rateLimiter.isAllowed(rateLimitKey, { maxRequests: 30, windowMs: 60 * 1000 })) {
      const resetTime = rateLimiter.timeUntilReset(rateLimitKey);
      const resetSeconds = Math.ceil(resetTime / 1000);
      
      return res.status(429).json({
        message: `Rate limit exceeded. Please try again in ${resetSeconds} seconds.`,
        resetIn: resetSeconds
      });
    }
    
    // We'll get 50 results in a single query instead of paginating
    // This significantly reduces API quota usage
    const maxResults = 50;
    
    // Generate cache key based on request parameters
    const cacheKey = `youtube_search:${query}:${pageToken || 'no_page'}:${contentType}:${duration}:${caption}:${quality}:${uploadDate}:${sortOrder}:${maxResults}`;
    
    // Check if we have a cached response
    const cachedResponse = apiCache.get(cacheKey);
    if (cachedResponse) {
      console.log(`[Cache hit] YouTube search: ${query}, page: ${pageToken || 'initial'}, type: ${contentType}`);
      return res.status(200).json(cachedResponse);
    }
    
    console.log(`[Cache miss] YouTube search: ${query}, page: ${pageToken || 'initial'}, type: ${contentType}, duration: ${duration}, caption: ${caption}, quality: ${quality}, uploadDate: ${uploadDate}, sortOrder: ${sortOrder}`);
    
    if (!query) {
      return res.status(400).json({ message: 'Query parameter is required' });
    }

    // Get API key from environment
    const apiKey = process.env.YOUTUBE_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ message: 'YouTube API key not configured' });
    }

    // Step 1: Search videos based on the query with pagination
    // Base URL for search with part=snippet and the query
    let searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
      query
    )}&maxResults=${maxResults}&type=video&key=${apiKey}`;
    
    // Add content type filtering if specified
    if (contentType === 'short') {
      // For shorts (typically < 60 seconds)
      searchUrl += '&videoDuration=short';
    } else if (contentType === 'video') {
      // For regular videos (medium duration)
      // YouTube API doesn't support multiple values with | symbol
      // Use medium as a reasonable proxy for longer videos
      searchUrl += '&videoDuration=medium';
    }
    // 'all' doesn't need any additional parameters
    
    // Add duration filtering if specified (overrides content type duration)
    if (duration === 'short') {
      searchUrl += '&videoDuration=short';
    } else if (duration === 'medium') {
      searchUrl += '&videoDuration=medium';
    } else if (duration === 'long') {
      searchUrl += '&videoDuration=long';
    }
    // 'any' doesn't need additional parameters
    
    // Add caption filtering if specified
    if (caption === 'closedCaption') {
      searchUrl += '&videoCaption=closedCaption';
    } else if (caption === 'none') {
      searchUrl += '&videoCaption=none';
    }
    // 'any' doesn't need additional parameters
    
    // Always filter for embeddable videos to avoid "Video unavailable" errors
    searchUrl += '&videoEmbeddable=true';
    
    // Add quality filtering if specified
    if (quality === 'high') {
      searchUrl += '&videoDefinition=high';
    } else if (quality === 'standard') {
      searchUrl += '&videoDefinition=standard';
    }
    // 'any' doesn't need additional parameters
    
    // Add upload date filtering if specified
    if (uploadDate !== 'any') {
      const now = new Date();
      let publishedAfter;
      
      switch (uploadDate) {
        case 'today':
          publishedAfter = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          publishedAfter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          publishedAfter = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'year':
          publishedAfter = new Date(now.getFullYear(), 0, 1);
          break;
      }
      
      if (publishedAfter) {
        searchUrl += `&publishedAfter=${publishedAfter.toISOString()}`;
      }
    }
    
    // Add sort order if specified (default is relevance)
    if (sortOrder !== 'relevance') {
      searchUrl += `&order=${sortOrder}`;
    }
    
    // Add pageToken if provided
    if (pageToken) {
      searchUrl += `&pageToken=${pageToken}`;
    }

    const searchResponse = await fetch(searchUrl);
    
    if (!searchResponse.ok) {
      const error = await searchResponse.json();
      throw new Error(error.error.message || 'Failed to fetch YouTube data');
    }

    const searchData = await searchResponse.json();
    
    // Step 2: Get detailed metadata for all videos
    const videoIds = searchData.items.map(item => item.id.videoId).join(',');
    
    if (!videoIds) {
      return res.status(200).json(searchData);
    }
    
    // Get detailed info for these videos - but request only what we need
    // Each part requested costs quota points, so only request what's actually needed
    const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoIds}&key=${apiKey}`;
    
    const detailsResponse = await fetch(detailsUrl);
    
    if (!detailsResponse.ok) {
      // If details fetch fails, return basic search results
      return res.status(200).json(searchData);
    }

    const detailsData = await detailsResponse.json();
    
    // Step 3: Merge the detailed data into the search results
    const enhancedItems = searchData.items.map(searchItem => {
      const detailedItem = detailsData.items.find(
        detailItem => detailItem.id === searchItem.id.videoId
      );
      
      if (detailedItem) {
        // Add isShort property to identify YouTube Shorts
        const duration = detailedItem.contentDetails?.duration || '';
        // Parse ISO 8601 duration format
        const durationMatch = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        const hours = durationMatch && durationMatch[1] ? parseInt(durationMatch[1]) : 0;
        const minutes = durationMatch && durationMatch[2] ? parseInt(durationMatch[2]) : 0;
        const seconds = durationMatch && durationMatch[3] ? parseInt(durationMatch[3]) : 0;
        const totalSeconds = hours * 3600 + minutes * 60 + seconds;
        
        // Consider videos under 60 seconds as shorts
        const isShort = totalSeconds <= 60;
        
        return {
          ...searchItem,
          contentDetails: detailedItem.contentDetails,
          statistics: detailedItem.statistics,
          topicDetails: detailedItem.topicDetails,
          // Add tags and category information directly for easier access
          tags: detailedItem.snippet.tags || [],
          categoryId: detailedItem.snippet.categoryId,
          isShort: isShort,
          duration: totalSeconds
        };
      }
      
      return searchItem;
    });
    
    // Return enhanced data with pagination tokens
    const enhancedData = {
      ...searchData,
      items: enhancedItems,
      // Include pagination tokens
      nextPageToken: searchData.nextPageToken || null,
      prevPageToken: searchData.prevPageToken || null,
      pageInfo: searchData.pageInfo || {}
    };
    
    // Cache the response before returning
    apiCache.set(cacheKey, enhancedData);
    
    return res.status(200).json(enhancedData);
    
  } catch (error) {
    console.error('YouTube API Error:', error);
    return res.status(500).json({ 
      message: 'Error fetching videos', 
      error: error.message 
    });
  }
}