import rateLimiter from '../../../utils/rateLimiter';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Check rate limits before proceeding
    const rateLimitKey = 'ai_chat';
    if (!rateLimiter.isAllowed(rateLimitKey, { maxRequests: 20, windowMs: 60 * 1000 })) {
      const resetTime = rateLimiter.timeUntilReset(rateLimitKey);
      const resetSeconds = Math.ceil(resetTime / 1000);
      
      return res.status(429).json({
        message: `Rate limit exceeded. Please try again in ${resetSeconds} seconds.`,
        resetIn: resetSeconds
      });
    }

    const { 
      videoId, 
      videoTitle, 
      summary, 
      transcript, 
      currentTime, 
      question, 
      chatSessionId,
      messageHistory 
    } = req.body;
    
    if (!question || !videoId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Question and video ID are required' 
      });
    }

    console.log(`[Chat API] Processing question for video: ${videoId}`);
    
    // Prepare context for AI
    const context = buildChatContext({
      videoTitle,
      summary,
      transcript,
      currentTime,
      question,
      messageHistory
    });

    // Generate AI response using Azure OpenAI
    const response = await generateAIResponse(context, question);
    
    console.log(`[Chat API] Generated response for video: ${videoId}`);
    
    return res.status(200).json({
      success: true,
      response,
      chatSessionId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Chat API Error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Error processing chat request', 
      error: error.message 
    });
  }
}

// Build context for AI processing
function buildChatContext({ videoTitle, summary, transcript, currentTime, question, messageHistory }) {
  let context = `Video Title: ${videoTitle || 'Unknown'}\n\n`;
  
  if (summary) {
    context += `Video Summary:\n${summary}\n\n`;
  }
  
  if (transcript && transcript.length > 0) {
    // Find relevant transcript sections based on current time
    const relevantTranscript = findRelevantTranscript(transcript, currentTime);
    if (relevantTranscript) {
      context += `Current Video Context (around ${formatTime(currentTime)}):\n${relevantTranscript}\n\n`;
    }
    
    // Also provide overall transcript overview for broader context
    const transcriptOverview = buildTranscriptOverview(transcript);
    if (transcriptOverview) {
      context += `Transcript Overview:\n${transcriptOverview}\n\n`;
    }
  }
  
  if (messageHistory && messageHistory.length > 0) {
    context += `Previous Conversation:\n`;
    messageHistory.forEach(msg => {
      if (msg.type === 'user') {
        context += `User: ${msg.content}\n`;
      } else if (msg.type === 'ai') {
        context += `AI: ${msg.content}\n`;
      }
    });
    context += '\n';
  }
  
  return context;
}

// Find relevant transcript sections based on current time
function findRelevantTranscript(transcript, currentTime) {
  if (!transcript || transcript.length === 0) return null;
  
  // Find segments around the current time (±30 seconds)
  const timeWindow = 30;
  const relevantSegments = transcript.filter(segment => {
    const segmentTime = segment.start || 0;
    return Math.abs(segmentTime - currentTime) <= timeWindow;
  });
  
  if (relevantSegments.length === 0) {
    // If no segments around current time, get first few segments
    return transcript.slice(0, 3).map(s => s.text).join(' ');
  }
  
  return relevantSegments.map(s => s.text).join(' ');
}

// Format time in MM:SS format
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Build transcript overview for broader context
function buildTranscriptOverview(transcript) {
  if (!transcript || transcript.length === 0) return null;
  
  try {
    // Get key segments from different parts of the video
    const totalSegments = transcript.length;
    const earlySegments = transcript.slice(0, Math.min(3, totalSegments));
    const middleSegments = transcript.slice(Math.floor(totalSegments / 2), Math.floor(totalSegments / 2) + 3);
    const lateSegments = transcript.slice(-3);
    
    let overview = `Total segments: ${totalSegments}\n`;
    
    if (earlySegments.length > 0) {
      overview += `Early content: ${earlySegments.map(s => s.text).join(' ').substring(0, 200)}...\n`;
    }
    
    if (middleSegments.length > 0) {
      overview += `Middle content: ${middleSegments.map(s => s.text).join(' ').substring(0, 200)}...\n`;
    }
    
    if (lateSegments.length > 0) {
      overview += `Later content: ${lateSegments.map(s => s.text).join(' ').substring(0, 200)}...\n`;
    }
    
    return overview;
  } catch (error) {
    console.error('Error building transcript overview:', error);
    return null;
  }
}

// Generate AI response using Azure OpenAI
async function generateAIResponse(context, question) {
  try {
    // Check if Azure OpenAI environment variables are set
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-12-01-preview';
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4-1';
    
    // Log configuration for debugging
    console.log(`[Chat API] Azure OpenAI Config - Endpoint: ${endpoint}, Deployment: ${deployment}, API Version: ${apiVersion}`);

    if (!apiKey || !endpoint) {
      console.error('Azure OpenAI environment variables not configured');
      throw new Error('AI service not configured');
    }

    // Construct the API URL
    const apiUrl = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

    // Build the system prompt
    const systemPrompt = `You are a helpful AI tutor for an educational video. Your role is to:

1. Answer questions about the video content clearly and accurately
2. Reference specific parts of the video when relevant
3. Use the video summary and transcript context to provide informed responses
4. Suggest follow-up questions to help users explore related topics
5. Maintain an engaging, educational tone
6. Stay focused on the video content and learning objectives

Always base your responses on the provided video context. If you don't have enough information to answer a question accurately, say so and suggest what additional context might help.`;

    // Build the user message with context
    const userMessage = `Based on this video context:

${context}

Please answer this question: ${question}

Provide a helpful, educational response that directly addresses the question and uses the video context to give specific, relevant information.`;

    // Make the API call to Azure OpenAI
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        max_tokens: 800,
        temperature: 0.7,
        top_p: 0.9,
        frequency_penalty: 0.1,
        presence_penalty: 0.1
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Azure OpenAI API Error:', response.status, errorData);
      throw new Error(`AI service error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response from AI service');
    }

    const aiResponse = data.choices[0].message.content;
    
    // Log successful response for debugging
    console.log(`[Chat API] Generated AI response for question: "${question}"`);
    
    return aiResponse;
    
  } catch (error) {
    console.error('AI Response Generation Error:', error);
    
    // Return a helpful error message to the user
    if (error.message.includes('AI service not configured')) {
      return `I'm sorry, but the AI service isn't properly configured right now. Please try again later or contact support if the issue persists.`;
    } else if (error.message.includes('AI service error')) {
      return `I'm experiencing some technical difficulties right now. Please try again in a moment.`;
    } else {
      return `I encountered an unexpected error while processing your question. Please try again or rephrase your question.`;
    }
  }
}
