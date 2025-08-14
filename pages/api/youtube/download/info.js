import { spawn } from 'child_process';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { id } = req.query;
    const { format = 'best' } = req.query;
    
    if (!id) {
      return res.status(400).json({ message: 'Video ID is required' });
    }

    // Build YouTube URL
    const videoUrl = `https://www.youtube.com/watch?v=${id}`;
    
    // Options for yt-dlp - just get filename without downloading
    let ytDlpArgs = [
      '--no-playlist',
      '--restrict-filenames',
      '--skip-download',
      '--print', 'filename',
      '-o', '%(title)s.%(ext)s'
    ];
    
    // Check for our custom format prefix
    let formatType = 'video'; // Default to video
    let formatValue = format;
    
    if (format.startsWith('audio:')) {
      formatType = 'audio';
      formatValue = format.substring(6); // Remove the 'audio:' prefix
    } else if (format.startsWith('video:')) {
      formatType = 'video';
      formatValue = format.substring(6); // Remove the 'video:' prefix
    }
    
    // Special handling based on format type
    if (formatType === 'audio') {
      ytDlpArgs.push('-f', formatValue);
    } else if (formatValue.includes('mp4')) {
      ytDlpArgs.push('-f', 'best[ext=mp4]/bestvideo[ext=mp4]');
    } else {
      ytDlpArgs.push('-f', formatValue);
      ytDlpArgs.push('--merge-output-format', 'mp4');
    }
    
    // Add the URL at the end
    ytDlpArgs.push(videoUrl);

    console.log(`[Info API] Getting filename info for video ${id} with format ${format}`);
    
    // Initialize yt-dlp process
    const infoProcess = spawn('yt-dlp', ytDlpArgs);
    
    let filename = '';
    let error = null;
    
    // Collect stdout data
    infoProcess.stdout.on('data', (data) => {
      filename += data.toString().trim();
    });

    infoProcess.stderr.on('data', (data) => {
      console.error(`[yt-dlp stderr] ${data}`);
      error = data.toString();
    });

    // Wait for process to complete
    await new Promise((resolve, reject) => {
      infoProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`yt-dlp exited with code ${code}: ${error || 'Unknown error'}`));
        }
      });
    });

    // Get estimated size using --print filesize
    const sizeProcess = spawn('yt-dlp', [
      '--no-playlist',
      '--skip-download',
      '--print', 'filesize_approx',
      '-f', format,
      videoUrl
    ]);
    
    let filesize = '';
    
    sizeProcess.stdout.on('data', (data) => {
      filesize += data.toString().trim();
    });
    
    await new Promise((resolve) => {
      sizeProcess.on('close', () => resolve());
    });
    
    let formattedSize = 'Unknown size';
    if (filesize && !isNaN(parseInt(filesize))) {
      const sizeInMB = parseInt(filesize) / (1024 * 1024);
      formattedSize = sizeInMB.toFixed(2) + ' MB';
    }

    // Clean filename for downloading
    const baseName = (filename || 'video').split('.')[0].replace(/[^a-zA-Z0-9._-]/g, '_');
    
    // Set extension based on format type
    const extension = formatType === 'audio' ? '.mp3' : '.mp4';
    const cleanFilename = baseName + extension;
    
    return res.status(200).json({
      filename: filename || 'video',
      format: formatValue,
      format_type: formatType,  // Include format type in response
      estimated_size: formattedSize,
      video_id: id,
      cleanFilename: cleanFilename
    });
    
  } catch (error) {
    console.error('[Info API Error]:', error);
    return res.status(500).json({ 
      message: 'Error getting video information', 
      error: error.message 
    });
  }
}