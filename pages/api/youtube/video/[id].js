import apiCache from '../../../../utils/apiCache';

// Function to extract chapters from YouTube video description
function extractChaptersFromDescription(description) {
  const chapters = [];
  
  // YouTube chapter format patterns:
  // 0:00 Chapter Title
  // 00:00 Chapter Title
  // 0:00:00 Chapter Title
  // 00:00:00 Chapter Title
  const chapterPattern = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s+(.+)$/gm;
  
  let match;
  while ((match = chapterPattern.exec(description)) !== null) {
    const hours = parseInt(match[1]) || 0;
    const minutes = parseInt(match[2]) || 0;
    const seconds = parseInt(match[3]) || 0;
    
    const startTime = hours * 3600 + minutes * 60 + seconds;
    const title = match[4].trim();
    
    chapters.push({
      start: startTime,
      title: title,
      formattedTime: `${hours > 0 ? hours + ':' : ''}${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    });
  }
  
  // Sort chapters by start time
  chapters.sort((a, b) => a.start - b.start);
  
  return chapters;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { id } = req.query;
    
    if (!id) {
      return res.status(400).json({ message: 'Video ID is required' });
    }
    
    // Generate cache key based on video ID
    const cacheKey = `youtube_video:${id}`;
    
    // Check if we have a cached response
    const cachedResponse = apiCache.get(cacheKey);
    if (cachedResponse) {
      console.log(`[Cache hit] YouTube video details: ${id}`);
      return res.status(200).json(cachedResponse);
    }
    
    console.log(`[Cache miss] YouTube video details: ${id}`);

    // Get API key from environment
    const apiKey = process.env.YOUTUBE_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ message: 'YouTube API key not configured' });
    }

    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics,topicDetails&id=${id}&key=${apiKey}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error.message || 'Failed to fetch video details');
    }

    const data = await response.json();
    
    // Extract chapters from description if available
    if (data.items && data.items[0]) {
      const video = data.items[0];
      const description = video.snippet?.description || '';
      
      // Extract chapters from description (YouTube chapter format: 0:00 Chapter Title)
      const chapters = extractChaptersFromDescription(description);
      
      if (chapters.length > 0) {
        video.chapters = chapters;
        console.log(`[Video API] Found ${chapters.length} chapters for video: ${id}`);
      } else {
        console.log(`[Video API] No chapters found for video: ${id}`);
      }
    }
    
    // Cache the response before returning
    apiCache.set(cacheKey, data);
    
    return res.status(200).json(data);
    
  } catch (error) {
    console.error('YouTube API Error:', error);
    return res.status(500).json({ 
      message: 'Error fetching video details', 
      error: error.message 
    });
  }
}