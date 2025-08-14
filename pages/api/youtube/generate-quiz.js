/**
 * API endpoint for generating quiz questions from video transcript
 * Enhanced with AI-powered question generation and improved algorithm
 */
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { summarizeTranscript } from '../../../utils/aiSummarizer';

export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { videoId, transcript, summary, config } = req.body;
    
    // Default configuration
    const quizConfig = {
      difficulty: config?.difficulty || 'medium', // 'easy', 'medium', 'hard'
      questionCount: config?.questionCount || 5, // Number of questions to generate
      includeExplanations: config?.includeExplanations !== false // Whether to include explanations
    };

    if (!videoId || !transcript || !summary) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: videoId, transcript, and summary'
      });
    }

    // Get actual video duration from YouTube API
    console.log(`🎯 QUIZ: Getting actual video duration for ${videoId}`);
    const actualDuration = await getVideoDuration(videoId);
    
    if (actualDuration) {
      console.log(`🎯 QUIZ: Using actual video duration: ${actualDuration}s (${Math.floor(actualDuration/60)}:${String(Math.floor(actualDuration%60)).padStart(2, '0')})`);
    } else {
      console.log(`🎯 QUIZ: Using transcript-estimated duration`);
    }

    // Try to generate AI questions first, fall back to algorithmic generation if it fails
    let questions;
    
    try {
      // Try AI-powered question generation
      questions = await generateAIQuestions(transcript, summary, videoId, quizConfig);
      console.log(`Generated ${questions.length} AI-powered questions for video ${videoId}`);
      
      // Print detailed question information
      console.log('\n===== GENERATED QUESTIONS DETAILS =====');
      questions.forEach((q, index) => {
        console.log(`Question ${index + 1}: "${q.question}"`);
        console.log(`Type: ${q.questionType || 'multiple_choice'}`);
        console.log(`Correct answer: ${q.correctAnswer}`);
        
        if (q.options) {
          console.log('Options:');
          q.options.forEach(opt => {
            const isCorrect = q.correctAnswer === opt.id || 
                            (Array.isArray(q.correctAnswer) && q.correctAnswer.includes(opt.id));
            console.log(`  ${opt.id}: ${opt.text} ${isCorrect ? '✓' : ''}`);
          });
        }
        
        if (q.explanation) {
          console.log(`Explanation: ${q.explanation}`);
        }
        
        if (q.timestamp) {
          console.log(`Timestamp: ${q.timestamp}s`);
        }
        
        console.log('-------------------------------');
      });
      console.log('=========================================\n');
    } catch (aiError) {
      console.error('AI question generation failed, using algorithmic fallback:', aiError);
      // Fallback to algorithmic generation is removed. Instead, we will show an error.
      console.error('AI question generation failed:', aiError);
      throw new Error('AI question generation failed. Please try again.');
    }

    // Assign timestamps using actual video duration if available
    if (questions && questions.length > 0) {
      if (actualDuration) {
        console.log(`🎯 QUIZ: Assigning timestamps using actual video duration: ${actualDuration}s`);
        questions = assignTimestampsToQuestions(questions, transcript, actualDuration);
      } else {
        console.log(`🎯 QUIZ: Assigning timestamps using transcript estimation`);
        questions = assignTimestampsToQuestions(questions, transcript);
      }
    }

    // Final logging of questions with timestamps
    if (questions && questions.length > 0) {
      console.log('\n===== FINAL QUESTIONS WITH TIMESTAMPS =====');
      questions.forEach((q, index) => {
        console.log(`Question ${index + 1}: "${q.question.substring(0, 70)}"... at ${q.timestamp}s`);
      });
      console.log('==========================================\n');
    }
    
    return res.status(200).json({
      success: true,
      questions,
      generationMethod: questions.method || 'algorithmic'
    });

  } catch (error) {
    console.error('Error generating quiz questions:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate quiz questions'
    });
  }
}

/**
 * Generate AI-powered questions using a similar approach to our transcript summarizer
 */
async function generateAIQuestions(transcript, summary, videoId, config) {
  return new Promise(async (resolve, reject) => {
    try {
      // Get cleaned transcript text - preserve full transcript for AI processing
      let transcriptText;
      let transcriptSegments = [];
      
      if (typeof transcript === 'string') {
        transcriptText = transcript;
        // Also create segments for timestamp assignment
        const lines = transcript.split('\n').filter(line => line.trim().length > 0);
        let currentTime = 0;
        lines.forEach((line, index) => {
          // Estimate time based on position in transcript
          currentTime = Math.floor(index * 30); // Assume 30 seconds per line
          transcriptSegments.push({
            start: currentTime,
            text: line.trim()
          });
        });
      } else if (Array.isArray(transcript)) {
        // Use structured transcript data
        transcriptSegments = transcript;
        transcriptText = transcript.map(seg => seg.text || '').join(' ');
      } else {
        return reject(new Error('Invalid transcript format'));
      }
      
      if (!transcriptText || transcriptText.trim().length < 100) {
        return reject(new Error('Transcript text too short for AI question generation'));
      }
      
      console.log(`Processing transcript: ${transcriptText.length} characters, ${transcriptSegments.length} segments`);
      
      // Calculate actual video duration from transcript segments
      const totalDuration = transcriptSegments.length > 0 ?
        (transcriptSegments[transcriptSegments.length - 1].start || 0) + 60 : // Add 60s for last segment
        600; // Default 10 minutes if no segments
      
      console.log(`Estimated video duration: ${Math.floor(totalDuration/60)}:${String(Math.floor(totalDuration%60)).padStart(2, '0')}`);
      
      // Create a temporary file for the transcript
      const tmpFile = path.join(os.tmpdir(), `transcript-${videoId}-${Date.now()}.txt`);
      fs.writeFileSync(tmpFile, transcriptText, 'utf-8');

      // Create a temporary file for the summary
      const summaryFile = path.join(os.tmpdir(), `summary-${videoId}-${Date.now()}.txt`);
      fs.writeFileSync(summaryFile, summary, 'utf-8');
      
      // Build the prompt for quiz generation
      const videoTitle = `Video ${videoId}`;
      const difficulty = config.difficulty;
      const numQuestions = config.questionCount;
      
      // Path to the Python script for quiz generation
      const scriptPath = path.join(process.cwd(), 'scripts', 'generate_quiz.py');
      
      // Check if script exists, if not, fall back to algorithmic generation
      if (!fs.existsSync(scriptPath)) {
        console.error('Quiz generation script not found at:', scriptPath);
        return reject(new Error('Quiz generation script not found'));
      }
      
      // Use Python virtual environment if available
      const pythonPath = process.env.VIRTUAL_ENV 
        ? path.join(process.env.VIRTUAL_ENV, 'bin', 'python')
        : path.join(process.cwd(), '.venv', 'bin', 'python');
        
      // Check if Python path exists and log for debugging
      console.log(`Python path: ${pythonPath}`);
      console.log(`Python path exists: ${fs.existsSync(pythonPath)}`);
      console.log(`Current working directory: ${process.cwd()}`);
      console.log(`VIRTUAL_ENV: ${process.env.VIRTUAL_ENV}`);
        
      // Get Azure OpenAI environment variables - necessary for Python script
      const azureOpenAIKey = process.env.AZURE_OPENAI_API_KEY;
      const azureOpenAIEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
      const azureOpenAIVersion = process.env.AZURE_OPENAI_API_VERSION;
      
      // Log for debugging
      console.log(`Azure OpenAI API Key: ${azureOpenAIKey ? 'set' : 'not set'}`);
      console.log(`Azure OpenAI Endpoint: ${azureOpenAIEndpoint || 'not set'}`);
      console.log(`Azure OpenAI API Version: ${azureOpenAIVersion || 'not set'}`);
      
      // Make sure we have Azure OpenAI credentials
      if (!azureOpenAIKey || !azureOpenAIEndpoint) {
        console.error('Azure OpenAI credentials not found in environment variables');
        return reject(new Error('Azure OpenAI credentials not found'));
      }
      
      // Args for the script
      const args = [
        scriptPath,
        tmpFile,
        videoTitle,
        summaryFile,
        '--difficulty', difficulty,
        '--num-questions', numQuestions.toString(),
        '--include-explanations', config.includeExplanations ? 'true' : 'false'
      ];
      
      console.log(`Running Python quiz generator with args: ${args.join(' ')}`);
      
      // Set environment variables for the Python process
      const env = {
        ...process.env,
        AZURE_OPENAI_API_KEY: azureOpenAIKey,
        AZURE_OPENAI_ENDPOINT: azureOpenAIEndpoint,
        AZURE_OPENAI_API_VERSION: azureOpenAIVersion || '2023-12-01-preview'
      };
      
      // Timeout for the process (60 seconds)
      const timeoutMs = 60000;
      let timeoutId;
      
      // Launch Python process with environment variables
      const py = spawn(pythonPath, args, { env });
      let output = '';
      let error = '';
      
      // Set timeout
      timeoutId = setTimeout(() => {
        console.log(`Python quiz generation timeout after ${timeoutMs/1000}s`);
        py.kill('SIGTERM');
        reject(new Error('Quiz generation timed out'));
      }, timeoutMs);
      
      // Collect output
      py.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      // Collect errors
      py.stderr.on('data', (data) => {
        error += data.toString();
        console.error(`Python quiz generator stderr: ${data}`);
      });
      
      // Handle process completion
      py.on('close', (code) => {
        clearTimeout(timeoutId);
        
        // Clean up temporary file
        try {
          fs.unlinkSync(tmpFile);
          fs.unlinkSync(summaryFile);
        } catch (e) {
          console.warn('Could not delete temporary file:', e.message);
        }
        
        if (code !== 0) {
          console.error(`Python quiz generator failed with code ${code}`);
          console.error('Error output:', error);
          return reject(new Error(`Quiz generation failed with code ${code}: ${error}`));
        }
        
        try {
          // Parse the output as JSON - handle debug output mixed with JSON
          let jsonStart = output.indexOf('{');
          let jsonEnd = output.lastIndexOf('}');
          
          if (jsonStart >= 0 && jsonEnd >= 0) {
            const jsonString = output.substring(jsonStart, jsonEnd + 1);
            const result = JSON.parse(jsonString);
            
            // Handle both nested format {"questions": [...]} and flat array [...]
            let questions;
            if (result.questions && Array.isArray(result.questions)) {
              questions = result.questions;
            } else if (Array.isArray(result)) {
              questions = result;
            } else {
              return reject(new Error('Invalid quiz generation output format'));
            }
            
            if (questions.length === 0) {
              return reject(new Error('No questions generated'));
            }

            // Ensure each question has a unique ID
            questions.forEach((q, index) => {
              if (!q.id) {
                q.id = `ai-q-${index + 1}`;
              }
            });
            
            // Assign timestamps to the AI-generated questions using the full transcript
            const questionsWithTimestamps = assignTimestampsToQuestions(questions, transcriptSegments);
            
            console.log(`Successfully generated ${questionsWithTimestamps.length} AI questions with timestamps`);
            resolve(questionsWithTimestamps);
          } else {
            return reject(new Error('No JSON found in AI output'));
          }
          
        } catch (parseError) {
          console.error('Failed to parse quiz generation output:', parseError);
          console.error('Raw output:', output);
          return reject(new Error('Failed to parse quiz generation output'));
        }
      });
      
      // Handle process errors
      py.on('error', (err) => {
        clearTimeout(timeoutId);
        console.error('Python quiz generator process error:', err);
        reject(new Error(`Quiz generation process error: ${err.message}`));
      });
      
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generate quiz questions from transcript content
 * Enhanced with timestamp-based extraction and smarter question generation
 */
function generateQuestionsFromTranscript(transcript, videoId, config = {}) {
  try {
    // Get configuration values with defaults
    const difficulty = config.difficulty || 'medium';
    const desiredQuestionCount = config.questionCount || 5;
    const includeExplanations = config.includeExplanations !== false;
    
    // Parse transcript into segments if it's provided as a string
    let transcriptSegments = [];
    
    // Check if transcript is a string or already parsed JSON
    if (typeof transcript === 'string') {
      // Try to identify transcript segments by common patterns
      const lines = transcript.split('\n').filter(line => line.trim().length > 0);
      
      // Extract timestamps and text with better time estimation
      let currentTime = 0;
      const estimatedDuration = lines.length * 30; // Assume 30 seconds per line
      
      lines.forEach((line, index) => {
        // Better time estimation based on position in transcript
        currentTime = Math.floor((index / lines.length) * estimatedDuration);
        
        transcriptSegments.push({
          start: currentTime,
          text: line.trim()
        });
      });
    } else {
      // Try to use transcript as structured data with segments
      transcriptSegments = Array.isArray(transcript) ? transcript : [];
    }
    
    // If we couldn't parse segments, create a basic fallback
    if (transcriptSegments.length === 0) {
      return generateBasicQuestions(transcript, videoId, config);
    }
    
    // Calculate actual video duration from transcript segments
    const totalDuration = transcriptSegments.length > 0 ?
      (transcriptSegments[transcriptSegments.length - 1].start || 0) + 60 : // Add 60s for last segment
      600; // Default 10 minutes if no segments
    
    console.log(`Video duration from transcript: ${Math.floor(totalDuration/60)}:${String(Math.floor(totalDuration%60)).padStart(2, '0')}`);
    
    // Adjust number of questions based on video duration
    const numQuestions = Math.min(
      desiredQuestionCount, 
      Math.max(3, Math.floor(totalDuration / 120)) // One question every 2 minutes
    );
    
    // Divide video into sections for questions, avoiding intro and outro
    const startTime = totalDuration * 0.1; // Start at 10% of video
    const endTime = totalDuration * 0.9;   // End at 90% of video
    const usableDuration = endTime - startTime;
    const sectionSize = usableDuration / numQuestions;
    
    console.log(`Generating ${numQuestions} questions between ${Math.floor(startTime/60)}:${String(Math.floor(startTime%60)).padStart(2, '0')} and ${Math.floor(endTime/60)}:${String(Math.floor(endTime%60)).padStart(2, '0')}`);
    
    const questions = [];
    
    // Generate a question for each section
    for (let i = 0; i < numQuestions; i++) {
      const targetTime = startTime + (sectionSize * (i + 0.5)); // Target middle of each section
      
      // Find segments in this section
      const sectionStart = startTime + (sectionSize * i);
      const sectionEnd = startTime + (sectionSize * (i + 1));
      
      // Find segments in this section
      const sectionSegments = transcriptSegments.filter(
        seg => (seg.start >= sectionStart && seg.start < sectionEnd)
      );
      
      // If no segments in this section, try to find nearby segments
      if (sectionSegments.length === 0) {
        // Look for segments within 30 seconds of the target time
        const nearbySegments = transcriptSegments.filter(
          seg => Math.abs(seg.start - targetTime) < 30
        );
        
        if (nearbySegments.length > 0) {
          sectionSegments.push(...nearbySegments);
        } else {
          // If still no segments, skip this question
          continue;
        }
      }
      
      // Find the closest segment to our target time
      const closestSegment = sectionSegments.reduce((prev, curr) => {
        return Math.abs(curr.start - targetTime) < Math.abs(prev.start - targetTime) ?
          curr : prev;
      }, sectionSegments[0]);
      
      // Extract keywords from this section
      const sectionText = sectionSegments.map(seg => seg.text).join(' ');
      const keywords = extractKeywords(sectionText);
      
      if (keywords.length === 0) continue;
      
      // Generate question from this segment
      const questionTypes = [
        'factual',    // What was mentioned?
        'conceptual', // How are concepts related?
        'detail',     // Specific detail from the content
        'true_false', // True/false questions
        'multiple'    // Multiple answer question
      ];
      
      // Choose question type based on position in video and difficulty
      let questionType;
      if (difficulty === 'easy') {
        // Easy questions are mostly factual and true/false
        questionType = ['factual', 'true_false', 'factual', 'detail', 'factual'][i % 5];
      } else if (difficulty === 'hard') {
        // Hard questions are mostly conceptual and multiple
        questionType = ['conceptual', 'detail', 'multiple', 'conceptual', 'detail'][i % 5];
      } else {
        // Medium difficulty has a mix
        questionType = questionTypes[i % questionTypes.length];
      }
      
      // Create the question
      const question = createQuestionByType(
        questionType,
        keywords,
        closestSegment.start,
        `q${i + 1}`,
        includeExplanations,
        difficulty
      );
      
      if (question) {
        questions.push(question);
      }
    }
    
    // If we didn't generate enough questions, add some basic ones
    if (questions.length < numQuestions) {
      const remaining = numQuestions - questions.length;
      console.log(`Adding ${remaining} basic questions to reach target count`);
      
      for (let i = 0; i < remaining; i++) {
        const basicQuestion = createQuestionByType(
          'factual',
          extractKeywords(transcriptSegments.map(seg => seg.text).join(' ')),
          Math.floor(totalDuration * (0.2 + (i * 0.1))), // Distribute remaining questions
          `basic${i + 1}`,
          includeExplanations,
          difficulty
        );
        
        if (basicQuestion) {
          questions.push(basicQuestion);
        }
      }
    }
    
    console.log(`Generated ${questions.length} algorithmic questions for video ${videoId}`);
    return questions;
    
  } catch (error) {
    console.error('Error generating questions from transcript:', error);
    return generateBasicQuestions(transcript, videoId, config);
  }
}

/**
 * Assign timestamps to questions based on transcript segments
 * Used for both AI-generated and algorithmic questions
 */
function assignTimestampsToQuestions(questions, transcript, totalDuration = null) {
  console.log(`🎯 QUIZ: Assigning timestamps to ${questions.length} questions`);
  
  let totalDurationForAssignment;
  if (totalDuration !== null) {
    totalDurationForAssignment = totalDuration;
    console.log(`🎯 QUIZ: Using actual video duration: ${totalDuration}s (${Math.floor(totalDuration/60)}:${String(Math.floor(totalDuration%60)).padStart(2, '0')})`);
  } else {
    // Estimate duration from transcript
    const totalWords = transcript.reduce((sum, segment) => sum + segment.text.split(' ').length, 0);
    const estimatedDuration = Math.max(totalWords * 0.6, 600); // At least 10 minutes
    totalDurationForAssignment = estimatedDuration;
    console.log(`🎯 QUIZ: Using estimated duration: ${estimatedDuration}s`);
  }
  
  console.log(`Total video duration for timestamp assignment: ${totalDurationForAssignment} seconds`);
  console.log(`Video length: ${Math.floor(totalDurationForAssignment/60)}:${String(Math.floor(totalDurationForAssignment%60)).padStart(2, '0')}`);
  
  // Calculate distribution range (10% to 90% of video)
  const startTime = totalDurationForAssignment * 0.1;
  const endTime = totalDurationForAssignment * 0.9;
  const minSpacing = Math.max(30, (endTime - startTime) / questions.length);
  
  console.log(`Assigning timestamps between ${Math.floor(startTime/60)}:${String(Math.floor(startTime%60)).padStart(2, '0')} and ${Math.floor(endTime/60)}:${String(Math.floor(endTime%60)).padStart(2, '0')}, min spacing: ${minSpacing.toFixed(1)}s`);
  
  // Sort questions by their original order or existing timestamps
  const sortedQuestions = [...questions].sort((a, b) => {
    // If questions already have timestamps, use them for ordering
    if (a.timestamp && b.timestamp) {
      return a.timestamp - b.timestamp;
    }
    // Otherwise, maintain original order
    return 0;
  });
  
  // Assign timestamps evenly distributed
  const timeStep = (endTime - startTime) / (questions.length - 1);
  
  sortedQuestions.forEach((question, index) => {
    if (questions.length === 1) {
      // Single question goes in the middle
      question.timestamp = totalDurationForAssignment * 0.5;
    } else {
      // Distribute questions evenly
      question.timestamp = startTime + (index * timeStep);
    }
    
    // Ensure timestamp doesn't exceed video duration
    question.timestamp = Math.min(question.timestamp, totalDurationForAssignment - 10);
    
    const minutes = Math.floor(question.timestamp / 60);
    const seconds = Math.floor(question.timestamp % 60);
    const percentage = ((question.timestamp / totalDurationForAssignment) * 100).toFixed(1);
    
    console.log(`Question ${index + 1} assigned timestamp: ${question.timestamp.toFixed(2)}s (${minutes}:${seconds.toString().padStart(2, '0')}) - ${percentage}% of video`);
  });
  
  // Log final distribution
  console.log('\nFinal question timestamps and distribution:');
  sortedQuestions.forEach((question, index) => {
    const minutes = Math.floor(question.timestamp / 60);
    const seconds = Math.floor(question.timestamp % 60);
    const percentage = ((question.timestamp / totalDurationForAssignment) * 100).toFixed(1);
    console.log(`Question ${index + 1}: ${minutes}:${seconds.toString().padStart(2, '0')} (${percentage}% of video) - "${question.question.substring(0, 50)}"...`);
  });
  
  const minPercentage = ((sortedQuestions[0].timestamp / totalDurationForAssignment) * 100).toFixed(1);
  const maxPercentage = ((sortedQuestions[sortedQuestions.length - 1].timestamp / totalDurationForAssignment) * 100).toFixed(1);
  console.log(`Distribution range: ${minPercentage}% - ${maxPercentage}% of video length`);
  
  return sortedQuestions;
}

/**
 * Extract meaningful keywords from text
 */
function extractKeywords(text) {
  // Basic algorithm to extract keywords and create questions
  const words = text.split(/\s+/);
  
  // Filter out common words
  const stopWords = new Set(['the', 'and', 'a', 'to', 'of', 'is', 'in', 'it', 'you', 'that', 
    'this', 'for', 'i', 'on', 'with', 'as', 'are', 'at', 'be', 'but', 'by', 'have', 
    'he', 'was', 'not', 'what', 'all', 'were', 'we', 'when', 'your', 'can', 'said', 
    'there', 'use', 'an', 'each', 'which', 'do', 'how', 'if', 'will', 'up', 'about', 
    'out', 'many', 'then', 'them', 'so', 'some', 'her', 'would', 'make', 'like', 'him', 
    'into', 'has', 'look', 'two', 'more', 'go', 'see', 'no', 'way', 'could', 'my', 
    'than', 'been', 'call', 'who', 'its', 'now', 'long', 'did', 'get', 'well']);

  // Get the most common meaningful words
  const wordCounts = {};
  words.forEach(word => {
    const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
    if (cleanWord.length > 4 && !stopWords.has(cleanWord)) {
      wordCounts[cleanWord] = (wordCounts[cleanWord] || 0) + 1;
    }
  });

  // Sort by frequency
  return Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0]);
}

/**
 * Create a question based on type, keywords, timestamp and difficulty
 */
function createQuestionByType(type, keywords, timestamp, id, includeExplanations = true, difficulty = 'medium') {
  // Ensure we have at least 4 keywords for options
  while (keywords.length < 4) {
    keywords.push(`concept${keywords.length + 1}`);
  }
  
  // Shuffle a copy of the keywords for different options
  const shuffledOptions = [...keywords.slice(0, 6)]
    .sort(() => Math.random() - 0.5);
  
  // Create explanation based on difficulty
  let explanation = '';
  if (includeExplanations) {
    switch (type) {
      case 'factual':
        explanation = `The video discusses ${keywords[0]} in detail at this point. Other concepts like ${keywords[1]} are mentioned but not as the primary focus.`;
        break;
      case 'conceptual':
        explanation = `${keywords[0]} and ${keywords[1]} are both related to ${keywords[2]} as discussed in the video. They are connected through their relationship to this concept.`;
        break;
      case 'detail':
        explanation = `The video specifically mentions that ${keywords[0]} relates to ${keywords[1]}. This is an important connection made in this section of the content.`;
        break;
      case 'true_false':
        explanation = `This statement is true based on the content presented in the video. The relationship between ${keywords[0]} and ${keywords[1]} is explicitly mentioned.`;
        break;
      case 'multiple':
        explanation = `Both ${keywords[0]} and ${keywords[2]} are mentioned in relation to ${keywords[1]} in this segment of the video.`;
        break;
      default:
        explanation = `This question tests your understanding of the key concepts discussed in this section of the video.`;
    }
  }
  
  // Create question based on type and difficulty
  switch (type) {
    case 'factual':
      return {
        id,
        question: difficulty === 'easy' 
          ? `What main topic is being discussed at this point in the video?`
          : (difficulty === 'hard' 
            ? `What specific concept is being explained in detail at timestamp ${Math.floor(timestamp / 60)}:${String(Math.floor(timestamp % 60)).padStart(2, '0')}?`
            : `What concept was discussed at this point in the video?`),
        options: [
          { id: 'a', text: keywords[0] },
          { id: 'b', text: difficulty === 'easy' ? 'An unrelated topic' : shuffledOptions[1] },
          { id: 'c', text: keywords[1] },
          { id: 'd', text: difficulty === 'hard' ? keywords[3] : 'None of the above' }
        ],
        correctAnswer: 'a',
        timestamp,
        explanation: includeExplanations ? explanation : undefined,
        difficulty
      };
      
    case 'conceptual':
      return {
        id,
        question: difficulty === 'easy'
          ? `How are ${keywords[0]} and ${keywords[1]} related?`
          : (difficulty === 'hard'
            ? `What complex relationship exists between ${keywords[0]}, ${keywords[1]}, and ${keywords[2]}?`
            : `Which of the following best describes the relationship between ${keywords[0]} and ${keywords[1]}?`),
        options: [
          { id: 'a', text: 'They are completely unrelated concepts' },
          { id: 'b', text: difficulty === 'easy' ? `They are similar concepts` : `${keywords[0]} is a specific type of ${keywords[1]}` },
          { id: 'c', text: `They are both related to ${keywords[2]}` },
          { id: 'd', text: difficulty === 'hard' ? `${keywords[0]} contradicts ${keywords[1]} in the context of ${keywords[2]}` : 'None of the above' }
        ],
        correctAnswer: 'c',
        timestamp,
        explanation: includeExplanations ? explanation : undefined,
        difficulty
      };
      
    case 'detail':
      return {
        id,
        question: difficulty === 'easy'
          ? `What was mentioned about ${keywords[0]}?`
          : (difficulty === 'hard'
            ? `What nuanced detail was explained about the relationship between ${keywords[0]} and ${keywords[1]}?`
            : `What specific detail was mentioned about ${keywords[0]}?`),
        options: [
          { id: 'a', text: difficulty === 'easy' ? 'It was not mentioned' : 'It contradicts established theories' },
          { id: 'b', text: `It relates to ${keywords[1]}` },
          { id: 'c', text: `It has no connection to ${keywords[2]}` },
          { id: 'd', text: difficulty === 'hard' ? `It represents a paradigm shift in understanding ${keywords[3]}` : `It's the opposite of ${keywords[3]}` }
        ],
        correctAnswer: 'b',
        timestamp,
        explanation: includeExplanations ? explanation : undefined,
        difficulty
      };
    
    case 'true_false':
      return {
        id,
        question: `True or False: ${keywords[0]} is related to ${keywords[1]} as discussed in the video.`, 
        options: [
          { id: 'a', text: 'True' },
          { id: 'b', text: 'False' }
        ],
        correctAnswer: 'a',
        timestamp,
        explanation: includeExplanations ? explanation : undefined,
        difficulty,
        questionType: 'true_false'
      };
      
    case 'multiple':
      return {
        id,
        question: `Select all concepts that relate to ${keywords[1]} as mentioned in the video. (Select all that apply)`, 
        options: [
          { id: 'a', text: keywords[0] },
          { id: 'b', text: keywords[3] },
          { id: 'c', text: keywords[2] },
          { id: 'd', text: keywords[4] }
        ],
        correctAnswer: ['a', 'c'], // Multiple correct answers
        timestamp,
        explanation: includeExplanations ? explanation : undefined,
        difficulty,
        questionType: 'multiple'
      };
      
    default:
      // Default question if type is not recognized
      return {
        id,
        question: `What is being discussed in this segment of the video?`,
        options: [
          { id: 'a', text: shuffledOptions[0] },
          { id: 'b', text: shuffledOptions[1] },
          { id: 'c', text: shuffledOptions[2] },
          { id: 'd', text: shuffledOptions[3] }
        ],
        correctAnswer: 'a',
        timestamp,
        explanation: includeExplanations ? 
          `The main topic discussed in this segment is ${shuffledOptions[0]}.` : undefined,
        difficulty
      };
  }
}

/**
 * Generate basic questions as fallback
 * Enhanced to support difficulty levels and explanations
 */
function generateBasicQuestions(transcript, videoId, config = {}) {
  // Get configuration values with defaults
  const difficulty = config.difficulty || 'medium';
  const desiredQuestionCount = config.questionCount || 5;
  const includeExplanations = config.includeExplanations !== false;
  
  // Basic algorithm to extract keywords and create questions
  const words = typeof transcript === 'string' ? 
    transcript.split(/\s+/) : 
    (Array.isArray(transcript) ? 
      transcript.map(seg => seg.text || '').join(' ').split(/\s+/) : 
      []);
  
  // Filter out common words
  const stopWords = new Set(['the', 'and', 'a', 'to', 'of', 'is', 'in', 'it', 'you', 'that', 
    'this', 'for', 'i', 'on', 'with', 'as', 'are', 'at', 'be', 'but', 'by', 'have', 
    'he', 'was', 'not', 'what', 'all', 'were', 'we', 'when', 'your', 'can', 'said', 
    'there', 'use', 'an', 'each', 'which', 'do', 'how', 'if', 'will', 'up', 'about', 
    'out', 'many', 'then', 'them', 'so', 'some', 'her', 'would', 'make', 'like', 'him', 
    'into', 'has', 'look', 'two', 'more', 'go', 'see', 'no', 'way', 'could', 'my', 
    'than', 'been', 'call', 'who', 'its', 'now', 'long', 'did', 'get', 'well']);

  // Get the most common meaningful words
  const wordCounts = {};
  words.forEach(word => {
    const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
    if (cleanWord.length > 4 && !stopWords.has(cleanWord)) {
      wordCounts[cleanWord] = (wordCounts[cleanWord] || 0) + 1;
    }
  });

  // Sort by frequency
  const sortedWords = Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0]);

  // Take top words for question generation
  const topWords = sortedWords.slice(0, 20);
  
  // Determine number of questions based on difficulty and config
  let numQuestions = Math.min(desiredQuestionCount, 5);
  
  // Determine timestamps for questions - try to space them evenly
  const estimatedDuration = typeof transcript === 'string' ? 
    words.length / 2.5 : // Rough estimate: 2.5 words per second
    (Array.isArray(transcript) && transcript.length > 0 ? 
      transcript[transcript.length - 1].start || 300 : 300);
  
  // Calculate spacing between questions
  const spacing = Math.max(30, Math.floor(estimatedDuration / (numQuestions + 1)));
  
  // Create questions based on difficulty
  const questions = [];
  
  // Generate different question types based on difficulty
  if (difficulty === 'easy') {
    // Easy questions - factual and true/false
    questions.push(
      // Question 1: Simple factual
      {
        id: 1,
        question: `What is the main topic discussed in this video?`,
        options: [
          { id: 'a', text: `${topWords[0] || 'Main topic'}` },
          { id: 'b', text: `${topWords[5] || 'Alternative topic'}` },
          { id: 'c', text: `${topWords[10] || 'Different subject'}` },
          { id: 'd', text: 'None of the above' }
        ],
        correctAnswer: 'a',
        timestamp: spacing,
        explanation: includeExplanations ? 
          `The main topic of the video is ${topWords[0] || 'the first major concept'} as it appears most frequently in the content.` : undefined,
        difficulty
      },
      
      // Question 2: True/false question
      {
        id: 2,
        question: `True or False: The video discusses ${topWords[1] || 'this topic'} in relation to ${topWords[0] || 'the main subject'}.`,
        options: [
          { id: 'a', text: 'True' },
          { id: 'b', text: 'False' }
        ],
        correctAnswer: 'a',
        timestamp: spacing * 2,
        explanation: includeExplanations ? 
          `This statement is true because ${topWords[1]} is mentioned in relation to ${topWords[0]} throughout the video.` : undefined,
        difficulty,
        questionType: 'true_false'
      }
    );
  } else if (difficulty === 'hard') {
    // Hard questions - conceptual relationships and details
    questions.push(
      // Question 1: Complex relationship
      {
        id: 1,
        question: `What complex relationship exists between ${topWords[0]}, ${topWords[1]}, and ${topWords[2]}?`,
        options: [
          { id: 'a', text: `${topWords[0]} influences ${topWords[1]} but contradicts ${topWords[2]}` },
          { id: 'b', text: `They form a hierarchical structure with ${topWords[2]} at the top` },
          { id: 'c', text: `They are interconnected concepts within the domain of ${topWords[3]}` },
          { id: 'd', text: `${topWords[0]} and ${topWords[2]} are subtypes of ${topWords[1]}` }
        ],
        correctAnswer: 'c',
        timestamp: spacing,
        explanation: includeExplanations ? 
          `These concepts are interconnected within the domain of ${topWords[3]} as explained in the video.` : undefined,
        difficulty
      },
      
      // Question 2: Detailed analysis
      {
        id: 2,
        question: `Which of these statements most accurately reflects the nuanced perspective presented about ${topWords[0]}?`,
        options: [
          { id: 'a', text: `It's a controversial concept with mixed evidence` },
          { id: 'b', text: `It represents a paradigm shift in understanding ${topWords[4]}` },
          { id: 'c', text: `It builds upon traditional interpretations while adding new insights` },
          { id: 'd', text: `It challenges conventional wisdom about ${topWords[2]}` }
        ],
        correctAnswer: 'c',
        timestamp: spacing * 2,
        explanation: includeExplanations ? 
          `The video presents ${topWords[0]} as building upon traditional interpretations while adding new insights.` : undefined,
        difficulty
      }
    );
  } else {
    // Medium difficulty - mix of question types
    questions.push(
      // Question 1: Conceptual understanding
      {
        id: 1,
        question: `What is the main topic discussed in relation to ${topWords[0] || 'the subject'}?`,
        options: [
          { id: 'a', text: `${topWords[1] || 'Topic 1'}` },
          { id: 'b', text: `${topWords[2] || 'Topic 2'}` },
          { id: 'c', text: `${topWords[3] || 'Topic 3'}` },
          { id: 'd', text: 'None of the above' }
        ],
        correctAnswer: 'a',
        timestamp: spacing,
        explanation: includeExplanations ? 
          `The video primarily discusses ${topWords[1]} in relation to ${topWords[0]}.` : undefined,
        difficulty
      },
      
      // Question 2: Relationship question
      {
        id: 2,
        question: `Which concept is most closely related to ${topWords[4] || 'the main subject'}?`,
        options: [
          { id: 'a', text: 'An unrelated concept' },
          { id: 'b', text: `${topWords[5] || 'Concept 1'}` },
          { id: 'c', text: 'A different subject entirely' },
          { id: 'd', text: `${topWords[6] || 'Concept 2'}` }
        ],
        correctAnswer: 'b',
        timestamp: spacing * 2,
        explanation: includeExplanations ? 
          `${topWords[5]} is discussed as being closely related to ${topWords[4]} in the video.` : undefined,
        difficulty
      }
    );
  }
  
  // Add more common questions regardless of difficulty
  questions.push(
    // Question about accuracy
    {
      id: questions.length + 1,
      question: `What would be the most accurate description of ${topWords[7] || 'the content'}?`,
      options: [
        { id: 'a', text: 'Something unrelated' },
        { id: 'b', text: 'A concept not covered' },
        { id: 'c', text: `It relates to ${topWords[8] || 'something specific'}` },
        { id: 'd', text: 'None of these options' }
      ],
      correctAnswer: 'c',
      timestamp: spacing * 3,
      explanation: includeExplanations ? 
        `The video describes ${topWords[7]} as relating to ${topWords[8]}.` : undefined,
      difficulty
    }
  );
  
  // Add different question types based on remaining top words
  if (topWords.length >= 12) {
    if (Math.random() > 0.5) {
      // Add a multiple-choice question
      questions.push({
        id: questions.length + 1,
        question: `Which of these concepts were discussed in relation to ${topWords[9]}? (Select all that apply)`,
        options: [
          { id: 'a', text: topWords[10] },
          { id: 'b', text: `unrelated concept` },
          { id: 'c', text: topWords[11] },
          { id: 'd', text: `different topic` }
        ],
        correctAnswer: ['a', 'c'],
        timestamp: spacing * 4,
        explanation: includeExplanations ? 
          `Both ${topWords[10]} and ${topWords[11]} were discussed in relation to ${topWords[9]}.` : undefined,
        difficulty,
        questionType: 'multiple'
      });
    } else {
      // Add a true/false question
      questions.push({
        id: questions.length + 1,
        question: `True or False: The video suggests that ${topWords[9]} has significant implications for ${topWords[10]}.`,
        options: [
          { id: 'a', text: 'True' },
          { id: 'b', text: 'False' }
        ],
        correctAnswer: 'a',
        timestamp: spacing * 4,
        explanation: includeExplanations ? 
          `This statement is true according to the content of the video.` : undefined,
        difficulty,
        questionType: 'true_false'
      });
    }
  }
  
  // Fill remaining questions if needed
  while (questions.length < numQuestions && topWords.length > questions.length * 2) {
    const qIndex = questions.length;
    const wordIndex = qIndex * 2;
    
    questions.push({
      id: questions.length + 1,
      question: `What is mentioned about ${topWords[wordIndex] || 'this concept'}?`,
      options: [
        { id: 'a', text: `It's related to ${topWords[wordIndex+1] || 'another concept'}` },
        { id: 'b', text: `It contradicts ${topWords[0] || 'the main topic'}` },
        { id: 'c', text: `It's a secondary topic` },
        { id: 'd', text: `It's not discussed in detail` }
      ],
      correctAnswer: 'a',
      timestamp: spacing * (qIndex + 1),
      explanation: includeExplanations ? 
        `The video mentions that ${topWords[wordIndex]} is related to ${topWords[wordIndex+1]}.` : undefined,
      difficulty
    });
  }
  
  return questions;
}

// Function to get actual video duration from YouTube API
async function getVideoDuration(videoId) {
  try {
    console.log(`🎯 QUIZ: Getting actual video duration for ${videoId}`);
    
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      console.warn("🎯 QUIZ: No YouTube API key, using transcript estimation");
      return null;
    }
    
    const url = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoId}&key=${apiKey}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn("🎯 QUIZ: Failed to fetch video duration, using transcript estimation");
      return null;
    }
    
    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      console.warn("🎯 QUIZ: No video found, using transcript estimation");
      return null;
    }
    
    const duration = data.items[0].contentDetails.duration;
    console.log(`🎯 QUIZ: Raw duration from API: ${duration}`);
    
    // Parse ISO 8601 duration format (PT1H2M3S)
    const durationMatch = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    
    if (!durationMatch) {
      console.warn("🎯 QUIZ: Could not parse duration format, using transcript estimation");
      return null;
    }
    
    const hours = parseInt(durationMatch[1] || 0);
    const minutes = parseInt(durationMatch[2] || 0);
    const seconds = parseInt(durationMatch[3] || 0);
    
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    console.log(`🎯 QUIZ: Actual video duration: ${totalSeconds}s (${hours}h ${minutes}m ${seconds}s)`);
    
    return totalSeconds;
  } catch (error) {
    console.error("🎯 QUIZ: Error getting video duration:", error);
    return null;
  }
}
