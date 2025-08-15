/**
 * Utility for summarizing video transcripts
 * 
 * This is a local implementation that does not require external API calls.
 * It uses simple text processing to create a summary.
 */
require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');

/**
 * Generates a summary of the video transcript.
 * Uses a fast JavaScript approach by default with option for more detailed Python agent.
 *
 * @param {Array} transcript - Array of transcript segments
 * @param {string} videoTitle - The title of the video
 * @param {Object} options - Options for summary generation
 * @param {boolean} options.usePython - Whether to use the Python agent (slower but better quality)
 * @param {string} options.difficulty - The desired vocabulary difficulty of the summary
 * @returns {Promise<string>} - Generated summary
 */
async function summarizeTranscript(transcript, videoTitle, options = {}) {
  // Default to fast JS summary unless explicitly requested to use Python
  const usePython = options.usePython === true;
  
  try {
    if (!transcript || transcript.length === 0) {
      return "No transcript available to summarize.";
    }

    // If using JS summary, skip Python processing completely
    if (!usePython) {
      console.log("Using fast JavaScript summary generation...");
      
      // Generate basic summary with JS
      const summary = generateBasicSummary(
        transcript.map(seg => seg.text).join(' '),
        videoTitle || ''
      );
      
      console.log("Generated fast JavaScript summary");
      return summary;
    }
    
    // If we're here, the user requested a full Python summary
    console.log("Using Python agent for detailed summary generation...");
    
    // Clean and combine transcript text
    const transcriptText = transcript.map(seg => seg.text).join(' ').trim();
    
    // Write transcript to a temporary file
    const fs = require('fs');
    const os = require('os');
    const tmp = require('tmp');
    const tmpFile = tmp.fileSync({ postfix: '.txt' });
    fs.writeFileSync(tmpFile.name, transcriptText, 'utf-8');

    // Use team_summarization.py which has better handling of transcripts
    const scriptPath = path.join(process.cwd(), 'scripts', 'summarize_transcript.py');
    
    // Use the new command line interface: transcript_file video_title [--detailed]
    const args = [
      scriptPath, 
      tmpFile.name,  // transcript_file
      videoTitle || 'Untitled Video'  // video_title
    ];
    
    // Add detailed flag if requested
    if (options.useDetailed) {
      args.push('--detailed');
    }

    // Add difficulty flag if requested
    if (options.difficulty) {
      args.push('--difficulty', options.difficulty);
    }
    
    // Use the virtual environment Python interpreter
    const pythonPath = process.env.VIRTUAL_ENV 
      ? path.join(process.env.VIRTUAL_ENV, 'bin', 'python')
      : path.join(process.cwd(), '.venv', 'bin', 'python');
    
    // Add debugging to console but not to client
    console.log(`Using Python interpreter: ${pythonPath}`);
    console.log(`Running script: ${scriptPath}`);
    console.log(`With arguments: ${args.join(' ')}`);
    
    // Set a timeout for the Python process - increased to 2 minutes
    const timeoutMs = 120000; // 120 seconds max
    let timeoutId;
    
    const summary = await new Promise((resolve, reject) => {
      // Use the specific Python interpreter from the virtual environment
      const py = spawn(pythonPath, args);
      let output = '';
      let error = '';
      let inSummaryOutput = false;
      let actualSummary = '';
      
      // Extract the actual summary content from the team summarization script output
      function extractSummary(text) {
        // Extract content between "AI SUMMARY" and benchmark results
        const summaryStartMarker = 'AI SUMMARY';
        const summaryEndMarker = '==================================================';
        
        try {
          // Find the AI SUMMARY section
          const aiSummaryIndex = text.indexOf(summaryStartMarker);
          if (aiSummaryIndex === -1) return '';
          
          // Find the start of the actual summary content (after the header)
          const summaryContentStart = text.indexOf(summaryEndMarker, aiSummaryIndex);
          if (summaryContentStart === -1) return '';
          
          // Find the end of the summary (the next "====" line after the content starts)
          const summaryEndIndex = text.indexOf(summaryEndMarker, summaryContentStart + summaryEndMarker.length);
          if (summaryEndIndex === -1) return '';
          
          // Extract the content between the markers
          const summaryContent = text.substring(
            summaryContentStart + summaryEndMarker.length,
            summaryEndIndex
          ).trim();
          
          return summaryContent;
        } catch (e) {
          console.error('Error extracting summary:', e);
          return '';
        }
      }
      
      // Set timeout
      timeoutId = setTimeout(() => {
        console.log(`Python summary process timeout after ${timeoutMs/1000}s`);
        py.kill('SIGTERM');
        reject(new Error('Summary generation timed out'));
      }, timeoutMs);
      
      py.stdout.on('data', (data) => { 
        const text = data.toString();
        output += text;
        
        // Just collect all output and extract the summary at the end
        // This is more reliable than trying to detect sections in streaming data
        
        // Log for server-side debugging only
        console.log(`Python stdout: ${text}`);
      });
      
      py.stderr.on('data', (data) => { 
        const text = data.toString();
        console.error(`Python stderr: ${text}`);
        error += text; 
      });
      
      py.on('close', (code) => {
        // Clear timeout since process completed
        clearTimeout(timeoutId);
        
        console.log(`Python process exited with code ${code}`);
        if (code === 0) {
          // Process the entire output to extract the summary
          const finalSummary = extractSummary(output);
          
          if (finalSummary) {
            console.log('Successfully extracted summary from team summarization');
            console.log('Summary length:', finalSummary.length);
            console.log('Summary preview:', finalSummary.substring(0, 100) + '...');
            resolve(finalSummary);
          } else {
            console.error('Failed to extract summary from output. Output preview:',
              output.substring(0, 200) + '...');
            reject(new Error('No summary could be extracted from the output'));
          }
        } else {
          reject(new Error(error || 'Python summarizer failed'));
        }
      });
    });

    // Only remove the temp file after we've read the summary
    try {
      tmpFile.removeCallback();
    } catch (e) {
      console.error('Error removing temp file:', e);
    }
    return summary;
  } catch (error) {
    console.error("Error generating transcript summary:", error);
    console.log("Falling back to JavaScript summary generation...");
    
    // Fallback to JS summary
    const summary = generateBasicSummary(
      transcript.map(seg => seg.text).join(' '),
      videoTitle || ''
    );
    
    console.log("Generated fallback JavaScript summary");
    return summary;
  }
}

/**
 * Generates an abstract summary based on content analysis.
 * This is a fast JS-based implementation that doesn't require external services.
 * 
 * @param {string} text - Cleaned transcript text
 * @param {string} title - Video title
 * @returns {string} - Abstract summary
 */
function generateBasicSummary(text, title) {
  // Start performance timer
  const startTime = Date.now();

  // If text is very short, provide a simple summary
  if (text.length < 100) {
    return `This appears to be a very brief video with limited spoken content.`;
  }
  
  // Find common topic keywords
  const words = text.toLowerCase().split(/\s+/);
  const wordFrequency = {};
  
  // Enhanced list of stop words for better keyword extraction
  const stopWords = new Set([
    'the', 'and', 'a', 'to', 'of', 'is', 'in', 'it', 'you', 'that', 'this', 'for', 'i', 'on', 'with', 
    'as', 'are', 'at', 'be', 'but', 'by', 'have', 'he', 'was', 'not', 'what', 'all', 'were', 'we', 'when', 
    'your', 'can', 'said', 'there', 'use', 'an', 'each', 'which', 'do', 'how', 'if', 'will', 'up', 'about',
    'out', 'many', 'then', 'them', 'so', 'some', 'her', 'would', 'make', 'like', 'him', 'into', 'has', 'look',
    'two', 'more', 'go', 'see', 'no', 'way', 'could', 'my', 'than', 'been', 'call', 'who', 'its', 'now', 'long',
    'did', 'get', 'well', 'just', 'yes', 'very', 'from', 'or', 'one', 'had', 'they', 'their', 'me', 'going', 
    'going', 'gonna', 'wanna', 'yeah', 'um', 'uh', 'actually', 'basically', 'really', 'right', 'gonna', 'kind', 'sort'
  ]);
  
  // Count word frequencies
  words.forEach(word => {
    if (word.length > 2 && !stopWords.has(word)) {
      wordFrequency[word] = (wordFrequency[word] || 0) + 1;
    }
  });
  
  // Get top keywords
  const topKeywords = Object.entries(wordFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(entry => entry[0]);
  
  // Extract keyphrases (common 2-3 word combinations)
  const keyphrases = extractKeyphrases(text, stopWords);
  
  // Detect content type with more categories
  const contentTypeInfo = detectContentType(text, title, topKeywords);
  const contentType = contentTypeInfo.type;
  const contentEmoji = contentTypeInfo.emoji;
  
  // Extract key sentences that contain multiple top keywords
  const keySentences = extractKeySentences(text, topKeywords, 3);
  
  // Determine topic from title and keywords
  const titleWords = title.toLowerCase().split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word));
  
  // Generate an abstract summary
  let summary = '';
  
  // Add introduction
  summary += `${contentEmoji} This video appears to be a ${contentType} about ${titleWords.join(' ')}. `; 
  
  // Add content insight based on keywords and phrases
  if (keyphrases.length > 0) {
    summary += `The content primarily discusses topics related to ${keyphrases.slice(0, 2).join(', ')}`;
    if (keyphrases.length > 2) {
      summary += `, with additional focus on ${keyphrases.slice(2, 4).join(', ')}.`;
    } else {
      summary += '.'; 
    }
  } else {
    summary += `The content primarily discusses topics related to ${topKeywords.slice(0, 3).join(', ')}`;
    if (topKeywords.length > 3) {
      summary += `, with additional focus on ${topKeywords.slice(3, 6).join(', ')}.`;
    } else {
      summary += '.'; 
    }
  }
  
  // Add key sentences if found
  if (keySentences.length > 0) {
    summary += `\n\n**Key Points:**\n- ${keySentences.slice(0, 3).join('\n- ')}`;
  }
  
  // Add content length insight
  const wordCount = words.length;
  if (wordCount < 500) {
    summary += `\n\nThis appears to be a relatively short video (${Math.round(wordCount/150)} minutes) with concise content.`;
  } else if (wordCount > 2000) {
    summary += `\n\nThis is an in-depth video (${Math.round(wordCount/150)} minutes) with extensive content.`;
  } else {
    summary += `\n\nThe video is approximately ${Math.round(wordCount/150)} minutes in length.`;
  }
  
  // Calculate processing time
  const endTime = Date.now();
  const processingTime = ((endTime - startTime) / 1000).toFixed(2);
  
  return `
## Video Summary: ${title}

${summary}

**Main Topics:**
- ${topKeywords.slice(0, 5).join('\n- ')}

*This is a fast-generated summary (${processingTime}s) that identifies key topics rather than providing a complete overview. For full context, please watch the video.*
  `.trim();
}

/**
 * Extract key sentences that contain multiple top keywords
 * @param {string} text - Full text to analyze
 * @param {Array} keywords - List of important keywords
 * @param {number} minKeywords - Minimum keywords to qualify as important
 * @returns {Array} - List of key sentences
 */
function extractKeySentences(text, keywords, minKeywords = 2) {
  // Split text into sentences
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  
  // Score each sentence by counting keywords
  const scoredSentences = sentences.map(sentence => {
    const sentenceLower = sentence.toLowerCase();
    let score = 0;
    
    // Count unique keywords in the sentence
    const foundKeywords = new Set();
    for (const keyword of keywords) {
      if (sentenceLower.includes(keyword.toLowerCase())) {
        foundKeywords.add(keyword);
        score++;
      }
    }
    
    return {
      text: sentence.trim(),
      score,
      keywords: foundKeywords
    };
  });
  
  // Filter sentences with at least minKeywords and sort by score
  return scoredSentences
    .filter(s => s.score >= minKeywords)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(s => s.text);
}

/**
 * Extract common phrases (2-3 word combinations)
 * @param {string} text - Text to analyze
 * @param {Set} stopWords - Set of stop words to filter out
 * @returns {Array} - List of common phrases
 */
function extractKeyphrases(text, stopWords) {
  // Normalize text and split into words
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
  
  // Generate 2-3 word phrases
  const phrases = {};
  
  // Generate 2-word phrases
  for (let i = 0; i < words.length - 1; i++) {
    const phrase = `${words[i]} ${words[i + 1]}`;
    phrases[phrase] = (phrases[phrase] || 0) + 1;
  }
  
  // Generate 3-word phrases
  for (let i = 0; i < words.length - 2; i++) {
    const phrase = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
    phrases[phrase] = (phrases[phrase] || 0) + 1;
  }
  
  // Sort by frequency and return top phrases
  return Object.entries(phrases)
    .filter(([phrase, count]) => count > 1) // Only phrases that appear more than once
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(entry => entry[0]);
}

/**
 * Detect the content type of a video based on text patterns
 * @param {string} text - Full transcript text
 * @param {string} title - Video title
 * @param {Array} keywords - Top keywords from the text
 * @returns {Object} - Content type info {type, emoji}
 */
function detectContentType(text, title, keywords) {
  const textLower = text.toLowerCase();
  const titleLower = title.toLowerCase();
  const allKeywords = [...keywords, ...titleLower.split(' ')].map(k => k.toLowerCase());
  
  // Define content type indicators with scores
  const contentTypes = [
    {
      type: 'tutorial',
      emoji: '📚',
      indicators: ['how to', 'tutorial', 'guide', 'learn', 'step', 'explain', 'create', 'build', 'steps', 'instructions']
    },
    {
      type: 'entertainment',
      emoji: '🎭',
      indicators: ['fun', 'cool', 'awesome', 'amazing', 'wow', 'incredible', 'hilarious', 'laugh', 'funny', 'entertainment']
    },
    {
      type: 'news report',
      emoji: '📰',
      indicators: ['news', 'report', 'breaking', 'latest', 'update', 'announced', 'reveals', 'says', 'statement', 'coverage']
    },
    {
      type: 'review',
      emoji: '⭐',
      indicators: ['review', 'rating', 'opinion', 'thoughts', 'experience', 'recommend', 'verdict', 'pros', 'cons', 'conclusion']
    },
    {
      type: 'interview',
      emoji: '🎤',
      indicators: ['interview', 'guest', 'conversation', 'discuss', 'talking', 'asked', 'answered', 'tells', 'podcast', 'chat']
    },
    {
      type: 'documentary',
      emoji: '🎬',
      indicators: ['documentary', 'history', 'investigation', 'explores', 'examines', 'reveals', 'insight', 'behind', 'story']
    },
    {
      type: 'analysis',
      emoji: '🔍',
      indicators: ['analysis', 'breakdown', 'examine', 'explore', 'detail', 'understand', 'perspective', 'viewpoint', 'theory']
    },
    {
      type: 'gaming content',
      emoji: '🎮',
      indicators: ['gameplay', 'game', 'playing', 'playthrough', 'walkthrough', 'level', 'mission', 'character', 'strategy']
    },
    {
      type: 'sports content',
      emoji: '🏆',
      indicators: ['sports', 'game', 'match', 'team', 'player', 'league', 'championship', 'tournament', 'score', 'play']
    }
  ];
  
  // Score each content type
  let highestScore = 0;
  let detectedType = { type: 'informational video', emoji: '📋' }; // Default
  
  // Check conversation pattern
  const conversationIndicators = text.match(/([?]\s+)|([:]\s+[A-Z])/g);
  if (conversationIndicators && conversationIndicators.length > 5) {
    return { type: 'conversation or interview', emoji: '🎤' };
  }
  
  // Score each content type
  for (const contentType of contentTypes) {
    let score = 0;
    
    // Check for indicators in text
    for (const indicator of contentType.indicators) {
      if (textLower.includes(indicator)) {
        score += 1;
      }
      
      // Extra weight for indicators in title
      if (titleLower.includes(indicator)) {
        score += 2;
      }
      
      // Check in keywords for even more weight
      if (allKeywords.some(k => k === indicator || k.includes(indicator))) {
        score += 1;
      }
    }
    
    if (score > highestScore) {
      highestScore = score;
      detectedType = contentType;
    }
  }
  
  return detectedType;
}

module.exports = {
  summarizeTranscript
};
