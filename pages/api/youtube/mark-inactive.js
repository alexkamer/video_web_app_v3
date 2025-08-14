import videoSummaryCache from '../../../utils/videoSummaryCache';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { videoId } = req.body;
    
    if (!videoId) {
      return res.status(400).json({ message: 'Video ID is required' });
    }

    // Mark user as inactive and clear cache for this video
    videoSummaryCache.markUserInactive(videoId);
    
    console.log(`[Cache] User marked inactive for video: ${videoId}`);
    
    return res.status(200).json({ 
      success: true, 
      message: 'User marked as inactive' 
    });
    
  } catch (error) {
    console.error('Mark Inactive Error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Error marking user as inactive' 
    });
  }
}
