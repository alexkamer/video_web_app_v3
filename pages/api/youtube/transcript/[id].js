const { fetchTranscript } = require('../../../../utils/transcriptFetcher');
const { processArrayTranscript } = require('../../../../utils/transcriptCorrection');
const apiCache = require('../../../../utils/apiCache');

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  
  const { id } = req.query;
  
  if (!id) {
    return res.status(400).json({ message: 'Video ID is required' });
  }
  
  try {
    // Generate cache keys based on video ID
    const transcriptCacheKey = `youtube_transcript:${id}`;
    const fixedTranscriptCacheKey = `youtube_fixed_transcript:${id}`;
    
    // Check for both original and fixed transcript in cache
    const cachedTranscript = apiCache.get(transcriptCacheKey);
    const cachedFixedTranscript = apiCache.get(fixedTranscriptCacheKey);
    
    // If we have both cached versions, return them
    if (cachedTranscript && cachedFixedTranscript) {
      console.log(`[Cache hit] YouTube transcript: ${id}`);
      return res.status(200).json({
        success: true,
        transcript: cachedTranscript,
        fixedTranscript: cachedFixedTranscript,
        usesFixedTranscript: true
      });
    }
    
    console.log(`[Cache miss] YouTube transcript: ${id}`);
    
    // Get original transcript
    const transcript = await fetchTranscript(id);
    console.log(`[Transcript API] Fetched transcript with ${transcript.length} segments for video: ${id}`);
    
    // Process the transcript to get a fixed version
    console.log(`[Transcript API] Starting transcript correction for video: ${id}`);
    try {
      const { fixedArray, originalText, fixedText } = await processArrayTranscript(transcript);
      console.log(`[Transcript API] Transcript correction completed. Original: ${originalText.length} chars, Fixed: ${fixedText.length} chars`);
      
      // Cache both versions
      apiCache.set(transcriptCacheKey, transcript);
      apiCache.set(fixedTranscriptCacheKey, fixedArray);
      
      return res.status(200).json({
        success: true,
        transcript: transcript,
        fixedTranscript: fixedArray,
        usesFixedTranscript: true
      });
    } catch (correctionError) {
      console.error(`[Transcript API] Error during transcript correction:`, correctionError);
      // Return original transcript if correction fails
      return res.status(200).json({
        success: true,
        transcript: transcript,
        fixedTranscript: transcript, // Use original as fallback
        usesFixedTranscript: false
      });
    }
  } catch (error) {
    console.error('Transcript fetch error:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch transcript',
      error: error.message
    });
  }
}