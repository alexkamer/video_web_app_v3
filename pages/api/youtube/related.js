export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { videoId } = req.query;
    
    if (!videoId) {
      return res.status(400).json({ message: 'videoId parameter is required' });
    }

    // Get API key from environment
    const apiKey = process.env.YOUTUBE_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ message: 'YouTube API key not configured' });
    }

    const maxResults = req.query.maxResults || 10;
    
    // Fetch related videos
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&relatedToVideoId=${videoId}&type=video&maxResults=${maxResults}&key=${apiKey}`;

    const response = await fetch(url);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error.message || 'Failed to fetch related videos');
    }

    const data = await response.json();
    
    // Enhance with additional metadata
    const videoIds = data.items.map(item => item.id.videoId).join(',');
    
    if (videoIds) {
      // Get detailed metadata for these videos
      const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics,topicDetails&id=${videoIds}&key=${apiKey}`;
      
      const detailsResponse = await fetch(detailsUrl);
      
      if (detailsResponse.ok) {
        const detailsData = await detailsResponse.json();
        
        // Merge the detailed data into the search results
        const enhancedItems = data.items.map(searchItem => {
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
        
        data.items = enhancedItems;
      }
    }
    
    return res.status(200).json(data);
    
  } catch (error) {
    console.error('YouTube API Error:', error);
    return res.status(500).json({ 
      message: 'Error fetching related videos', 
      error: error.message 
    });
  }
}