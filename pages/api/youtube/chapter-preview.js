import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { videoId, chapterTitle, chapterStart, chapterEnd, transcript } = req.body;

    if (!videoId || !chapterTitle || !transcript) {
      return res.status(400).json({ message: 'Missing required parameters' });
    }

    console.log(`[Chapter Preview] Generating preview for chapter: ${chapterTitle} (${chapterStart}s - ${chapterEnd}s)`);

    // Extract transcript segments for this chapter
    const chapterTranscript = extractChapterTranscript(transcript, chapterStart, chapterEnd);
    
    if (!chapterTranscript || chapterTranscript.trim().length === 0) {
      return res.status(400).json({ message: 'No transcript content found for this chapter' });
    }

    // Create temporary file for the chapter transcript
    const tempFile = path.join(os.tmpdir(), `chapter-${videoId}-${Date.now()}.txt`);
    fs.writeFileSync(tempFile, chapterTranscript, 'utf8');

    // Generate preview using AI
    const preview = await generateChapterPreview(chapterTitle, tempFile);

    // Clean up temp file after Python process is done
    try {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    } catch (error) {
      console.warn('Failed to delete temp file:', error);
    }

    return res.status(200).json({ preview });

  } catch (error) {
    console.error('[Chapter Preview] Error:', error);
    return res.status(500).json({ message: 'Failed to generate chapter preview' });
  }
}

function extractChapterTranscript(transcript, startTime, endTime) {
  if (!Array.isArray(transcript)) {
    return '';
  }

  const chapterSegments = transcript.filter(segment => {
    return segment.start >= startTime && segment.start < endTime;
  });

  return chapterSegments.map(segment => segment.text).join(' ');
}

async function generateChapterPreview(chapterTitle, transcriptFile) {
  return new Promise((resolve, reject) => {
    // Use Python script to generate preview
    const pythonPath = process.env.VIRTUAL_ENV 
      ? path.join(process.env.VIRTUAL_ENV, 'bin', 'python')
      : path.join(process.cwd(), '.venv', 'bin', 'python');

    const scriptPath = path.join(process.cwd(), 'scripts', 'generate_chapter_preview.py');

    console.log(`[Chapter Preview] Using Python: ${pythonPath}`);
    console.log(`[Chapter Preview] Script: ${scriptPath}`);

    const pythonProcess = spawn(pythonPath, [
      scriptPath,
      transcriptFile,
      chapterTitle
    ]);

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const preview = stdout.trim();
          console.log(`[Chapter Preview] Generated preview: ${preview.substring(0, 100)}...`);
          resolve(preview);
        } catch (error) {
          console.error('[Chapter Preview] Error parsing output:', error);
          reject(new Error('Failed to parse preview output'));
        }
      } else {
        console.error(`[Chapter Preview] Python process failed with code ${code}`);
        console.error('[Chapter Preview] stderr:', stderr);
        reject(new Error(`Python process failed with code ${code}`));
      }
    });

    pythonProcess.on('error', (error) => {
      console.error('[Chapter Preview] Failed to start Python process:', error);
      reject(error);
    });
  });
}
