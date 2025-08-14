import { spawn } from 'child_process';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { id } = req.query;
    
    if (!id) {
      return res.status(400).json({ message: 'Video ID is required' });
    }

    // Build YouTube URL
    const videoUrl = `https://www.youtube.com/watch?v=${id}`;
    
    // Options for yt-dlp to list formats
    const ytDlpArgs = [
      '--no-playlist',
      '--no-warnings',
      '--ignore-errors',
      '-F', // List formats
      videoUrl
    ];

    console.log(`[Format API] Fetching formats for video ${id}`);
    
    // Initialize process to get formats
    const formatProcess = spawn('yt-dlp', ytDlpArgs);
    
    let formatsOutput = '';
    let error = null;
    
    // Collect stdout data
    formatProcess.stdout.on('data', (data) => {
      formatsOutput += data.toString();
    });

    formatProcess.stderr.on('data', (data) => {
      console.error(`[yt-dlp stderr] ${data}`);
      error = data.toString();
    });

    // Wait for process to complete with timeout
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        formatProcess.kill();
        reject(new Error('yt-dlp process timed out'));
      }, 30000); // 30 second timeout
      
      formatProcess.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve();
        } else {
          // Don't fail completely if we got some output
          if (formatsOutput.trim()) {
            console.warn(`yt-dlp exited with code ${code} but got some output`);
            resolve();
          } else {
            reject(new Error(`yt-dlp exited with code ${code}: ${error || 'Unknown error'}`));
          }
        }
      });
    });

    // Process the formats output
    const formatLines = formatsOutput.trim().split('\n');
    
    // Parse format information
    const formats = [];
    const audioFormats = [];
    const videoFormats = [];
    const videoAudioFormats = [];
    
    let parsingFormats = false;
    let headerRow = '';
    
    for (const line of formatLines) {
      if (line.includes('format code')) {
        parsingFormats = true;
        headerRow = line;
        continue;
      }
      
      if (parsingFormats && line.trim()) {
        try {
          // Parse different format patterns
          // Example line: "251 webm audio only tiny 49k , webm_dash container, opus @160k (48000Hz), 1.77MiB"
          // Example video: "399 mp4   1920x1080   2160k , mp4_dash container, av01.0.09M.08@2160k (23.976 fps), 123.45MiB"
          
          // Extract format code which is always the first part
          const formatCode = line.split(' ')[0].trim();
          
          // Check if format has video and audio
          const hasVideo = !line.includes('audio only') && (line.includes('x') || line.includes('video only'));
          const hasAudio = !line.includes('video only');
          
          // Try to extract resolution
          let resolution = 'N/A';
          const resMatch = line.match(/(\d+x\d+)/);
          if (resMatch) resolution = resMatch[1];
          
          // Try to extract width and height
          let width = 0;
          let height = 0;
          if (resolution !== 'N/A') {
            const dimensionsMatch = resolution.match(/(\d+)x(\d+)/);
            if (dimensionsMatch) {
              width = parseInt(dimensionsMatch[1]);
              height = parseInt(dimensionsMatch[2]);
            }
          }
          
          // Video resolution categorization
          let resolutionCategory = 'unknown';
          if (height >= 1070 && height <= 1090) resolutionCategory = '1080p';
          else if (height >= 710 && height <= 730) resolutionCategory = '720p';
          else if (height >= 470 && height <= 490) resolutionCategory = '480p';
          else if (height >= 350 && height <= 370) resolutionCategory = '360p';
          else if (height >= 230 && height <= 250) resolutionCategory = '240p';
          else if (height > 0) resolutionCategory = `${height}p`;
          
          // Extract extension
          const extension = line.split(' ').filter(p => p.trim())[1] || 'N/A';
          
          // Try to extract filesize
          let filesize = 'N/A';
          const filesizeMatch = line.match(/([\d.]+[KMG]iB|[\d.]+B)/i);
          if (filesizeMatch) filesize = filesizeMatch[1];
          
          // Extract format note (audio only, video only, etc)
          let formatNote = '';
          if (line.includes('audio only')) formatNote = 'audio only';
          else if (line.includes('video only')) formatNote = 'video only';
          else formatNote = 'video+audio';
          
          // Extract codec info
          let codec = 'N/A';
          if (line.includes('av01')) codec = 'AV1';
          else if (line.includes('avc1')) codec = 'H.264';
          else if (line.includes('vp9')) codec = 'VP9';
          else if (line.includes('opus')) codec = 'Opus';
          else if (line.includes('mp4a')) codec = 'AAC';
          
          // Extract bitrate
          let bitrate = 'N/A';
          const bitrateMatch = line.match(/([\d.]+k)/);
          if (bitrateMatch) bitrate = bitrateMatch[1];
          
          // Create format object
          const format = {
            format_code: formatCode,
            extension: extension,
            resolution: resolution,
            width: width,
            height: height,
            resolution_category: resolutionCategory,
            filesize: filesize,
            format_note: formatNote,
            has_video: hasVideo,
            has_audio: hasAudio,
            codec: codec,
            bitrate: bitrate,
            original_line: line.trim(),
          };
          
          // Add to the appropriate category
          formats.push(format);
          
          if (hasVideo && hasAudio) {
            videoAudioFormats.push(format);
          } else if (hasVideo) {
            videoFormats.push(format);
          } else if (hasAudio) {
            audioFormats.push(format);
          }
        } catch (err) {
          console.error(`[Format Parsing Error]: ${err.message} for line: ${line}`);
          // Add the line anyway as a raw format
          formats.push({
            format_code: line.split(' ')[0] || 'unknown',
            original_line: line.trim(),
            parse_error: true
          });
        }
      }
    }
    
    // Sort formats by height (resolution) for easier selection
    videoFormats.sort((a, b) => b.height - a.height);
    videoAudioFormats.sort((a, b) => b.height - a.height);

    // Return the available formats
    return res.status(200).json({
      video_id: id,
      formats: formats,
      video_formats: videoFormats,
      audio_formats: audioFormats,
      video_audio_formats: videoAudioFormats,
      raw_output: formatsOutput // Include raw output for debugging
    });
    
  } catch (error) {
    console.error('[Format API Error]:', error);
    return res.status(500).json({ 
      message: 'Error fetching video formats', 
      error: error.message 
    });
  }
}