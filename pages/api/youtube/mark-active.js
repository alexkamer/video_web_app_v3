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

    // Mark user as active on this video
    videoSummaryCache.markUserActive(videoId);
    
    console.log(`[Cache] User marked active for video: ${videoId}`);
    
    return res.status(200).json({ 
      success: true, 
      message: 'User marked as active' 
    });
    
  } catch (error) {
    console.error('Mark Active Error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Error marking user as active' 
    });
  }
}
