import comprehensiveSummaryCache from '../../../utils/comprehensiveSummaryCache';
import rateLimiter from '../../../utils/rateLimiter';
const { spawn } = require('child_process');

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Check rate limits before proceeding
    const rateLimitKey = 'incremental_summary';
    if (!rateLimiter.isAllowed(rateLimitKey, { maxRequests: 10, windowMs: 60 * 1000 })) {
      const resetTime = rateLimiter.timeUntilReset(rateLimitKey);
      const resetSeconds = Math.ceil(resetTime / 1000);
      
      return res.status(429).json({
        message: `Rate limit exceeded. Please try again in ${resetSeconds} seconds.`,
        resetIn: resetSeconds
      });
    }

    const { transcript, videoTitle, videoId, difficulty, length, action } = req.body;
    
    if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Valid transcript array is required' 
      });
    }
    
    if (!videoId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Video ID is required' 
      });
    }

    // Check if we have cached comprehensive summaries
    const cachedSummaries = comprehensiveSummaryCache.getComprehensiveSummaries(videoId);
    
    if (action === 'get_available') {
      // Return currently available summaries
      if (cachedSummaries) {
        const availableVariants = {};
        const unavailableVariants = [];
        
        // Check which variants are available
        for (const diff of ['beginner', 'novice', 'intermediate', 'advanced', 'expert', 'professional']) {
          availableVariants[diff] = {};
          for (const len of ['very_short', 'short', 'normal', 'long', 'very_long']) {
            if (cachedSummaries[diff]?.[len]) {
              availableVariants[diff][len] = cachedSummaries[diff][len];
            } else {
              unavailableVariants.push(`${diff}_${len}`);
            }
          }
        }
        
        return res.status(200).json({
          success: true,
          availableVariants,
          unavailableVariants,
          isComplete: unavailableVariants.length === 0,
          source: 'cache'
        });
      } else {
        // No cache exists, start generation
        return res.status(200).json({
          success: true,
          availableVariants: {},
          unavailableVariants: [],
          isComplete: false,
          source: 'generating'
        });
      }
    }
    
    if (action === 'get_variant') {
      // Return a specific variant if available
      if (!difficulty || !length) {
        return res.status(400).json({ 
          success: false, 
          message: 'Difficulty and length are required for get_variant action' 
        });
      }
      
      if (cachedSummaries) {
        const summary = comprehensiveSummaryCache.getSummaryVariant(videoId, difficulty, length);
        if (summary) {
          return res.status(200).json({
            success: true,
            summary,
            difficulty,
            length,
            source: 'cache'
          });
        }
      }
      
      return res.status(404).json({
        success: false,
        message: 'Requested variant not available yet'
      });
    }
    
    if (action === 'start_generation') {
      // Start the generation process in the background
      if (cachedSummaries) {
        // Already cached, return immediately
        return res.status(200).json({
          success: true,
          message: 'Summaries already available',
          source: 'cache'
        });
      }
      
      // Start generation in background (non-blocking)
      generateSummariesInBackground(videoId, transcript, videoTitle);
      
      return res.status(200).json({
        success: true,
        message: 'Generation started in background',
        source: 'generating'
      });
    }
    
    return res.status(400).json({
      success: false,
      message: 'Invalid action. Use get_available, get_variant, or start_generation'
    });
    
  } catch (error) {
    console.error('Incremental Summary Error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Error with incremental summary generation', 
      error: error.message 
    });
  }
}

// Background generation function
async function generateSummariesInBackground(videoId, transcript, videoTitle) {
  try {
    console.log(`[Incremental Summary] Starting background generation for video: ${videoId}`);
    
    const transcriptText = transcript.map(seg => seg.text).join(' ').trim();
    
    // Write transcript to a temporary file
    const fs = require('fs');
    const os = require('os');
    const tmp = require('tmp');
    const path = require('path');
    
    const tmpFile = tmp.fileSync({ postfix: '.txt' });
    fs.writeFileSync(tmpFile.name, transcriptText, 'utf-8');

    // Use the comprehensive summarization script
    const scriptPath = path.join(process.cwd(), 'scripts', 'comprehensive_summarize_transcript.py');
    
    // Use the virtual environment Python interpreter
    const pythonPath = process.env.VIRTUAL_ENV 
      ? path.join(process.env.VIRTUAL_ENV, 'bin', 'python')
      : path.join(process.cwd(), '.venv', 'bin', 'python');
    
    console.log(`[Incremental Summary] Using Python interpreter: ${pythonPath}`);
    console.log(`[Incremental Summary] Running script: ${scriptPath}`);
    
    // Set a timeout for the Python process
    const timeoutMs = 300000; // 5 minutes max for 30 variants
    let timeoutId;
    
    const allSummaries = await new Promise((resolve, reject) => {
      const py = spawn(pythonPath, [
        scriptPath, 
        tmpFile.name,  // transcript_file
        videoTitle || 'Untitled Video'  // video_title
      ]);
      
      let output = '';
      let error = '';
      
      // Set timeout
      timeoutId = setTimeout(() => {
        console.log(`[Incremental Summary] Python process timeout after ${timeoutMs/1000}s`);
        py.kill('SIGTERM');
        reject(new Error('Comprehensive summary generation timed out'));
      }, timeoutMs);
      
      py.stdout.on('data', (data) => { 
        const text = data.toString();
        output += text;
        console.log(`[Incremental Summary] Python stdout: ${text}`);
      });
      
      py.stderr.on('data', (data) => { 
        const text = data.toString();
        console.error(`[Incremental Summary] Python stderr: ${text}`);
        error += text; 
      });
      
      py.on('close', (code) => {
        clearTimeout(timeoutId);
        
        console.log(`[Incremental Summary] Python process exited with code ${code}`);
        if (code === 0) {
          // Extract JSON results from output
          try {
            // Look for JSON in the output
            const jsonMatch = output.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const jsonData = JSON.parse(jsonMatch[0]);
              resolve(jsonData.summaries);
            } else {
              // Fallback: try to parse the entire output as JSON
              const jsonData = JSON.parse(output);
              resolve(jsonData.summaries);
            }
          } catch (parseError) {
            console.error('[Incremental Summary] Error parsing JSON:', parseError);
            reject(new Error('Failed to parse comprehensive summary results'));
          }
        } else {
          reject(new Error(error || 'Python comprehensive summarizer failed'));
        }
      });
    });

    // Clean up temp file
    try {
      tmpFile.removeCallback();
    } catch (e) {
      console.error('[Incremental Summary] Error removing temp file:', e);
    }
    
    // Cache the comprehensive summaries
    comprehensiveSummaryCache.setComprehensiveSummaries(videoId, allSummaries);
    
    console.log(`[Incremental Summary] Background generation completed for video: ${videoId}`);
    
  } catch (error) {
    console.error(`[Incremental Summary] Background generation failed for video ${videoId}:`, error);
  }
}
