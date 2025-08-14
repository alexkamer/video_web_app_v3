/**
 * Utility for fetching YouTube video transcripts using yt-dlp
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const glob = promisify(require('glob'));

/**
 * Fetch auto-generated English transcript using yt-dlp
 * 
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<Array>} - Array of transcript segments with start time, duration, and text
 */
async function fetchTranscript(videoId) {
  // Create temp directory
  const tmpdir = path.join(os.tmpdir(), `transcript-${videoId}-${Date.now()}`);
  
  try {
    // Create temp directory
    fs.mkdirSync(tmpdir, { recursive: true });
    
    const baseOutput = path.join(tmpdir, '%(id)s.%(ext)s');
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    
    // First try with English subtitles
    try {
      await runYtDlp(url, baseOutput, ['en']);
    } catch (err) {
      console.error('Failed to fetch English subtitles, trying all languages:', err.message);
    }
    
    // Find any English .srt file
    let srtFiles = await glob(path.join(tmpdir, `${videoId}*.en*.srt`));
    let vttFiles = [];
    // If no English .srt subtitles found, try with all languages
    if (!srtFiles || srtFiles.length === 0) {
      try {
        await runYtDlp(url, baseOutput);
      } catch (err) {
        console.error('Failed to fetch any subtitles:', err.message);
      }
      // Find any .srt file
      srtFiles = await glob(path.join(tmpdir, `${videoId}*.srt`));
    }
    // If still no .srt, look for .vtt
    if (!srtFiles || srtFiles.length === 0) {
      vttFiles = await glob(path.join(tmpdir, `${videoId}*.vtt`));
    }
    if ((!srtFiles || srtFiles.length === 0) && (!vttFiles || vttFiles.length === 0)) {
      // List what was found for debugging
      const allFiles = fs.readdirSync(tmpdir);
      throw new Error(`No subtitles found for this video. Available files: ${allFiles.join(', ')}`);
    }
    // Prefer English if available, otherwise use the first .srt or .vtt
    let preferredFile = null;
    if (srtFiles && srtFiles.length > 0) {
      for (const file of srtFiles) {
        if (file.includes('.en')) {
          preferredFile = file;
          break;
        }
      }
      if (!preferredFile) {
        preferredFile = srtFiles[0];
      }
    } else if (vttFiles && vttFiles.length > 0) {
      for (const file of vttFiles) {
        if (file.includes('.en')) {
          preferredFile = file;
          break;
        }
      }
      if (!preferredFile) {
        preferredFile = vttFiles[0];
      }
    }
    // Parse the subtitle file
    let transcript;
    if (preferredFile.endsWith('.srt')) {
      transcript = parseSrtFile(preferredFile);
    } else if (preferredFile.endsWith('.vtt')) {
      transcript = parseVttFile(preferredFile);
    } else {
      throw new Error('Unknown subtitle file format: ' + preferredFile);
    }
    
    // Clean up temp directory
    fs.rmSync(tmpdir, { recursive: true, force: true });
    
    return transcript;
  } catch (err) {
    // Clean up temp directory in case of error
    try {
      fs.rmSync(tmpdir, { recursive: true, force: true });
    } catch (cleanupErr) {
      console.error('Failed to clean up temp directory:', cleanupErr);
    }
    
    throw err;
  }
}

/**
 * Run yt-dlp command to fetch subtitles
 * 
 * @param {string} url - YouTube video URL
 * @param {string} baseOutput - Output file path pattern
 * @param {Array} languages - Optional array of language codes
 * @returns {Promise<void>}
 */
function runYtDlp(url, baseOutput, languages = null) {
  return new Promise((resolve, reject) => {
    const args = [
      url,
      '--skip-download',
      '--write-auto-subs',
      '--sub-format', 'srt',
      '-o', baseOutput
    ];
    
    if (languages && languages.length > 0) {
      args.push('--sub-langs', languages.join(','));
    }
    
    const ytDlpProcess = spawn('yt-dlp', args);
    
    let stdout = '';
    let stderr = '';
    
    ytDlpProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    ytDlpProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    ytDlpProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`yt-dlp exited with code ${code}: ${stderr}`));
      }
    });
  });
}

/**
 * Parse SRT file format to extract transcript segments
 * 
 * @param {string} filePath - Path to SRT file
 * @returns {Array} - Array of transcript segments
 */
function parseSrtFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  
  const transcript = [];
  let block = [];
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (!trimmedLine) {
      if (block.length > 0) {
        // Process completed block
        processBlock(block, transcript);
        block = [];
      }
    } else {
      block.push(trimmedLine);
    }
  }
  
  // Process the last block if any
  if (block.length > 0) {
    processBlock(block, transcript);
  }
  
  return transcript;
}

/**
 * Process an SRT block and add to transcript if valid
 * 
 * @param {Array} block - Lines in an SRT block
 * @param {Array} transcript - Output transcript array
 */
function processBlock(block, transcript) {
  if (block.length < 3) return;
  
  const timeLine = block[1];
  let text = block.slice(2).join(' ');
  
  // Clean HTML-style tags like <00:00:11.200><c> wing</c>
  text = cleanHtmlTags(text);
  
  // Skip if cleaned text is empty
  if (!text.trim()) return;
  
  // Parse SRT timestamp format: 00:02:23,430 --> 00:02:25,940
  const timeMatch = timeLine.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3}) --> (\d{2}):(\d{2}):(\d{2}),(\d{3})/);
  
  if (timeMatch) {
    const [, h1, m1, s1, ms1, h2, m2, s2, ms2] = timeMatch;
    
    const start = parseInt(h1) * 3600 + parseInt(m1) * 60 + parseInt(s1) + parseInt(ms1) / 1000;
    const end = parseInt(h2) * 3600 + parseInt(m2) * 60 + parseInt(s2) + parseInt(ms2) / 1000;
    const duration = end - start;
    
    transcript.push({
      start,
      duration,
      text
    });
  }
}

/**
 * Clean HTML-style tags from transcript text
 *
 * @param {string} text - Raw transcript text
 * @returns {string} - Cleaned text
 */
function cleanHtmlTags(text) {
  // Remove HTML-style timing tags like <00:00:11.200>
  let cleaned = text.replace(/<\d{2}:\d{2}:\d{2}\.\d{3}>/g, '');
  
  // Remove style tags like <c>text</c>
  cleaned = cleaned.replace(/<\/?[a-z][^>]*>/g, '');
  
  // Remove any leftover angle brackets and their contents
  cleaned = cleaned.replace(/<[^>]*>/g, '');
  
  // Replace multiple spaces with a single space
  cleaned = cleaned.replace(/\s+/g, ' ');
  
  return cleaned.trim();
}

/**
 * Parse VTT file format to extract transcript segments
 * @param {string} filePath - Path to VTT file
 * @returns {Array} - Array of transcript segments
 */
function parseVttFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  const transcript = [];
  let block = [];
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      if (block.length > 0) {
        processVttBlock(block, transcript);
        block = [];
      }
    } else {
      block.push(trimmedLine);
    }
  }
  if (block.length > 0) {
    processVttBlock(block, transcript);
  }
  return transcript;
}
/**
 * Process a VTT block and add to transcript if valid
 * @param {Array} block - Lines in a VTT block
 * @param {Array} transcript - Output transcript array
 */
function processVttBlock(block, transcript) {
  // VTT blocks may start with a number or not
  let timeLineIdx = 0;
  if (block[0].match(/^\d+$/)) {
    timeLineIdx = 1;
  }
  const timeLine = block[timeLineIdx];
  const text = block.slice(timeLineIdx + 1).join(' ');
  // Parse VTT timestamp format: 00:02:23.430 --> 00:02:25.940
  const timeMatch = timeLine.match(/(\d{2}):(\d{2}):(\d{2})[.,](\d{3}) --> (\d{2}):(\d{2}):(\d{2})[.,](\d{3})/);
  if (timeMatch) {
    const [, h1, m1, s1, ms1, h2, m2, s2, ms2] = timeMatch;
    const start = parseInt(h1) * 3600 + parseInt(m1) * 60 + parseInt(s1) + parseInt(ms1) / 1000;
    const end = parseInt(h2) * 3600 + parseInt(m2) * 60 + parseInt(s2) + parseInt(ms2) / 1000;
    const duration = end - start;
    transcript.push({
      start,
      duration,
      text
    });
  }
}

module.exports = {
  fetchTranscript
};