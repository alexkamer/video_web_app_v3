import { summarizeTranscript } from '../../../utils/aiSummarizer';
import videoSummaryCache from '../../../utils/videoSummaryCache';
import rateLimiter from '../../../utils/rateLimiter';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Check rate limits before proceeding
    const rateLimitKey = 'ai_summary';
    if (!rateLimiter.isAllowed(rateLimitKey, { maxRequests: 10, windowMs: 60 * 1000 })) {
      const resetTime = rateLimiter.timeUntilReset(rateLimitKey);
      const resetSeconds = Math.ceil(resetTime / 1000);
      
      return res.status(429).json({
        message: `Rate limit exceeded. Please try again in ${resetSeconds} seconds.`,
        resetIn: resetSeconds
      });
    }

    const { transcript, videoTitle, videoId, difficulty } = req.body;
    
    if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Valid transcript array is required' 
      });
    }
    
    // Check if we have a cached response
    const cachedSummary = videoSummaryCache.getSummary(videoId, difficulty);
    if (cachedSummary) {
      console.log(`[Cache hit] AI Summary for video: ${videoId}, difficulty: ${difficulty}`);
      return res.status(200).json({
        success: true,
        summary: cachedSummary
      });
    }
    
    console.log(`[Cache miss] Generating AI Summary for video: ${videoId}, difficulty: ${difficulty}`);
    
    // Default to fast Python summarization for better quality and speed
    // User can request detailed AI summary with a detailed flag if needed
    const useDetailed = req.body.detailed === true;
    const options = { usePython: true, useDetailed, difficulty };
    
    console.log(`Summary generation mode: ${useDetailed ? 'Detailed AI (Python)' : 'Fast AI (Python)'}, difficulty: ${difficulty}`);
    
    // Generate summary using the appropriate method based on options
    const summary = await summarizeTranscript(transcript, videoTitle || 'Unknown Video Title', options);
    
    // Cache the summary
    if (summary && videoId) {
      videoSummaryCache.setSummary(videoId, summary, difficulty);
    }
    
    return res.status(200).json({
      success: true,
      summary
    });
    
  } catch (error) {
    console.error('AI Summary Error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Error generating summary', 
      error: error.message 
    });
  }
}

// Helper function to get video duration from transcript
function getDurationFromTranscript(transcript) {
  if (!transcript || transcript.length === 0) {
    return 0;
  }
  
  const lastSegment = transcript[transcript.length - 1];
  return (lastSegment.start || 0) + (lastSegment.duration || 10); // Add 10s for last segment
}