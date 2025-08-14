import apiCache from '../../../../utils/apiCache';

// Function to extract chapters from YouTube video description
function extractChaptersFromDescription(description) {
  const chapters = [];
  
  // First, try to find a chapters section
  const chaptersSectionMatch = description.match(/(?:🔖\s*Chapters?|Chapters?|Timestamps?|Table of Contents?):\s*\n([\s\S]*?)(?:\n\n|\n[A-Z]|$)/i);
  
  if (chaptersSectionMatch) {
    const chaptersText = chaptersSectionMatch[1];
    console.log(`[Sections API] Found chapters section: ${chaptersText.substring(0, 200)}...`);
    
    // Extract chapters from the chapters section
    // Handle both formats: MM:SS and HH:MM:SS
    const chapterPattern = /(\d{1,2}):(\d{2})(?::(\d{2}))?\s+(.+?)(?=\n|$)/g;
    
    let match;
    while ((match = chapterPattern.exec(chaptersText)) !== null) {
      let hours = 0;
      let minutes = 0;
      let seconds = 0;
      
      if (match[3] !== undefined) {
        // Format: HH:MM:SS
        hours = parseInt(match[1]) || 0;
        minutes = parseInt(match[2]) || 0;
        seconds = parseInt(match[3]) || 0;
      } else {
        // Format: MM:SS (most common for YouTube chapters)
        minutes = parseInt(match[1]) || 0;
        seconds = parseInt(match[2]) || 0;
      }
      
      const startTime = hours * 3600 + minutes * 60 + seconds;
      const title = match[4].trim();
      
      if (title && title.length > 0) {
        chapters.push({
          start: startTime,
          title: title,
          formattedTime: `${hours > 0 ? hours + ':' : ''}${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        });
      }
    }
  } else {
    // Fallback: look for chapters anywhere in the description
    console.log(`[Sections API] No chapters section found, searching entire description...`);
    
    // YouTube chapter format patterns:
    // 0:00 Chapter Title (MM:SS)
    // 00:00 Chapter Title (MM:SS)
    // 0:00:00 Chapter Title (HH:MM:SS)
    // 00:00:00 Chapter Title (HH:MM:SS)
    const chapterPattern = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s+(.+)$/gm;
    
    let match;
    while ((match = chapterPattern.exec(description)) !== null) {
      let hours = 0;
      let minutes = 0;
      let seconds = 0;
      
      if (match[3] !== undefined) {
        // Format: HH:MM:SS
        hours = parseInt(match[1]) || 0;
        minutes = parseInt(match[2]) || 0;
        seconds = parseInt(match[3]) || 0;
      } else {
        // Format: MM:SS (most common for YouTube chapters)
        minutes = parseInt(match[1]) || 0;
        seconds = parseInt(match[2]) || 0;
      }
      
      const startTime = hours * 3600 + minutes * 60 + seconds;
      const title = match[4].trim();
      
      if (title && title.length > 0) {
        chapters.push({
          start: startTime,
          title: title,
          formattedTime: `${hours > 0 ? hours + ':' : ''}${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        });
      }
    }
  }
  
  // Sort chapters by start time
  chapters.sort((a, b) => a.start - b.start);
  
  console.log(`[Sections API] Extracted ${chapters.length} chapters:`, chapters.map(c => `${c.formattedTime} - ${c.title}`));
  
  return chapters;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { id } = req.query;
    
    if (!id) {
      return res.status(400).json({ message: 'Video ID is required' });
    }

    // Check cache first
    const cacheKey = `sections_${id}`;
    const cachedSections = apiCache.get(cacheKey);
    if (cachedSections) {
      console.log(`[Sections API] Cache hit for video: ${id}`);
      return res.status(200).json(cachedSections);
    }

    // Get API key from environment
    const apiKey = process.env.YOUTUBE_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ message: 'YouTube API key not configured' });
    }

    // Fetch video details from YouTube API directly
    const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics,topicDetails&id=${id}&key=${apiKey}`;
    const youtubeResponse = await fetch(videoUrl);
    
    if (!youtubeResponse.ok) {
      const error = await youtubeResponse.json();
      throw new Error(error.error.message || 'Failed to fetch video details');
    }
    
    const youtubeData = await youtubeResponse.json();
    
    if (!youtubeData.items || youtubeData.items.length === 0) {
      throw new Error('Video not found');
    }
    
    const video = youtubeData.items[0];
    const videoDuration = video?.contentDetails?.duration || null;
    
    // Parse ISO 8601 duration (e.g., "PT4M32S" = 4 minutes 32 seconds)
    let durationInSeconds = 0;
    if (videoDuration) {
      const durationMatch = videoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (durationMatch) {
        const hours = parseInt(durationMatch[1]) || 0;
        const minutes = parseInt(durationMatch[2]) || 0;
        const seconds = parseInt(durationMatch[3]) || 0;
        durationInSeconds = hours * 3600 + minutes * 60 + seconds;
      }
    }
    
    console.log(`[Sections API] Video duration: ${durationInSeconds} seconds (${Math.round(durationInSeconds/60)} minutes)`);
    
    // Extract chapters from description if available
    const description = video.snippet?.description || '';
    
    // Extract chapters from description (YouTube chapter format: 0:00 Chapter Title)
    const chapters = extractChaptersFromDescription(description);
    
    if (chapters.length > 0) {
      console.log(`[Sections API] Found ${chapters.length} YouTube chapters for video: ${id}`);
      
      // Cache and return the predefined chapters
      apiCache.set(cacheKey, { sections: chapters, source: 'youtube' });
      return res.status(200).json({ sections: chapters, source: 'youtube' });
    } else {
      console.log(`[Sections API] No YouTube chapters found for video: ${id}`);
    }
    
    // If no predefined chapters, generate AI-determined sections
    console.log(`[Sections API] Generating AI-determined sections for video: ${id}`);
    
    const videoTitle = video.snippet?.title || 'Video';
    const sections = await generateAISectionsFromTitle(videoTitle, durationInSeconds);
    
    // Cache and return the AI-generated sections
    apiCache.set(cacheKey, { sections, source: 'ai' });
    return res.status(200).json({ sections, source: 'ai' });
    
  } catch (error) {
    console.error('Sections API Error:', error);
    return res.status(500).json({ 
      message: 'Error generating sections', 
      error: error.message 
    });
  }
}

// Function to generate AI sections from video title and duration
async function generateAISectionsFromTitle(videoTitle, videoDurationSeconds = 0) {
  try {
    // Create prompt for AI to determine meaningful sections based on title and duration
    const prompt = `Based on this video title and duration, create meaningful sections/chapters that would likely be covered in this type of video.

Video Title: "${videoTitle}"
Video Duration: ${videoDurationSeconds > 0 ? `${Math.round(videoDurationSeconds / 60)} minutes (${videoDurationSeconds} seconds)` : 'Unknown'}

Please create logical sections that would typically be found in this type of content. Each section should:
1. Have a clear, descriptive title
2. Start at a logical point in the video timeline
3. Cover a coherent topic or theme
4. **CRITICAL**: All timestamps must be within the actual video duration
5. For short videos (< 5 min): Use 2-4 sections with shorter intervals
6. For medium videos (5-15 min): Use 4-6 sections with moderate intervals
7. For long videos (> 15 min): Use 5-8 sections with longer intervals
8. Start with 0:00 for the introduction
9. End with a conclusion section before the video ends

Return the sections as a JSON array with this format:
[
  {
    "start": 0,
    "title": "Introduction",
    "formattedTime": "0:00"
  },
  {
    "start": 120,
    "title": "Main Topic Discussion", 
    "formattedTime": "2:00"
  }
]

Only return valid JSON, no other text.`;

    // Call Azure OpenAI API
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4-1';
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-12-01-preview';
    
    if (!apiKey || !endpoint) {
      throw new Error('Azure OpenAI configuration not found');
    }
    
    const apiUrl = `${endpoint}openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that analyzes video titles and creates meaningful sections/chapters. Return only valid JSON arrays.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.3
      })
    });
    
    if (!response.ok) {
      throw new Error(`Azure OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Parse the JSON response
    const sections = JSON.parse(content);
    
    // Validate and format the sections, ensuring timestamps don't exceed video duration
    const validatedSections = sections.map(section => ({
      start: section.start,
      title: section.title,
      formattedTime: section.formattedTime || formatTime(section.start)
    }));
    
    // Filter out sections that exceed the video duration
    if (videoDurationSeconds > 0) {
      const validSections = validatedSections.filter(section => section.start < videoDurationSeconds);
      
      if (validSections.length === 0) {
        console.warn(`[Sections API] All AI-generated sections exceeded video duration (${videoDurationSeconds}s), using fallback`);
        return generateFallbackSections(videoDurationSeconds);
      }
      
      if (validSections.length < validatedSections.length) {
        console.warn(`[Sections API] Filtered out ${validatedSections.length - validSections.length} sections that exceeded video duration`);
      }
      
      return validSections;
    }
    
    return validatedSections;
    
  } catch (error) {
    console.error('Error generating AI sections from title:', error);
    // Fallback to generic sections if AI fails
    return generateFallbackSections();
  }
}

// Fallback function to generate generic sections based on video duration
function generateFallbackSections(videoDurationSeconds = 0) {
  if (videoDurationSeconds <= 0) {
    // Default fallback for unknown duration
    return [
      { start: 0, title: "Introduction", formattedTime: "0:00" },
      { start: 120, title: "Main Content", formattedTime: "2:00" },
      { start: 300, title: "Summary", formattedTime: "5:00" }
    ];
  }
  
  const durationMinutes = Math.round(videoDurationSeconds / 60);
  
  if (durationMinutes < 5) {
    // Short videos: 2-3 sections
    return [
      { start: 0, title: "Introduction", formattedTime: "0:00" },
      { start: Math.floor(videoDurationSeconds * 0.4), title: "Main Content", formattedTime: formatTime(Math.floor(videoDurationSeconds * 0.4)) },
      { start: Math.floor(videoDurationSeconds * 0.8), title: "Conclusion", formattedTime: formatTime(Math.floor(videoDurationSeconds * 0.8)) }
    ];
  } else if (durationMinutes < 15) {
    // Medium videos: 4-5 sections
    return [
      { start: 0, title: "Introduction", formattedTime: "0:00" },
      { start: Math.floor(videoDurationSeconds * 0.25), title: "Getting Started", formattedTime: formatTime(Math.floor(videoDurationSeconds * 0.25)) },
      { start: Math.floor(videoDurationSeconds * 0.5), title: "Main Content", formattedTime: formatTime(Math.floor(videoDurationSeconds * 0.5)) },
      { start: Math.floor(videoDurationSeconds * 0.75), title: "Key Points", formattedTime: formatTime(Math.floor(videoDurationSeconds * 0.75)) },
      { start: Math.floor(videoDurationSeconds * 0.9), title: "Conclusion", formattedTime: formatTime(Math.floor(videoDurationSeconds * 0.9)) }
    ];
  } else {
    // Long videos: 5-6 sections
    return [
      { start: 0, title: "Introduction", formattedTime: "0:00" },
      { start: Math.floor(videoDurationSeconds * 0.2), title: "Overview", formattedTime: formatTime(Math.floor(videoDurationSeconds * 0.2)) },
      { start: Math.floor(videoDurationSeconds * 0.4), title: "Main Content", formattedTime: formatTime(Math.floor(videoDurationSeconds * 0.4)) },
      { start: Math.floor(videoDurationSeconds * 0.6), title: "Examples", formattedTime: formatTime(Math.floor(videoDurationSeconds * 0.6)) },
      { start: Math.floor(videoDurationSeconds * 0.8), title: "Key Takeaways", formattedTime: formatTime(Math.floor(videoDurationSeconds * 0.8)) },
      { start: Math.floor(videoDurationSeconds * 0.95), title: "Conclusion", formattedTime: formatTime(Math.floor(videoDurationSeconds * 0.95)) }
    ];
  }
}

// Helper function to format time
function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}
