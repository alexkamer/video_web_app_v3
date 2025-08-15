#!/usr/bin/env python3
"""
Quiz Generation Script for Video Transcripts

This script generates quiz questions based on video transcript content
using Azure OpenAI models. It creates different types of questions with varying
difficulty levels and provides explanations for answers.
"""

import argparse
import json
import os
import sys
import re
import random
import dotenv
from typing import List, Dict, Any, Optional, Union

# Add parent directory to path to enable importing from transcript_summarizer
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load environment variables from .env.local
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env.local')
dotenv.load_dotenv(env_path)
print(f"Loading environment from: {env_path}")

# Check if we're running in a virtual environment
IN_VENV = sys.prefix != sys.base_prefix
VENV_PATH = os.environ.get('VIRTUAL_ENV') or '.venv'

# Check Azure OpenAI configuration
AZURE_API_KEY = os.environ.get('AZURE_OPENAI_API_KEY')
AZURE_ENDPOINT = os.environ.get('AZURE_OPENAI_ENDPOINT')
AZURE_API_VERSION = os.environ.get('AZURE_OPENAI_API_VERSION', '2023-12-01-preview')

print(f"AZURE_OPENAI_API_KEY: {'set' if AZURE_API_KEY else 'not set'}")
print(f"AZURE_OPENAI_ENDPOINT: {AZURE_ENDPOINT}")
print(f"AZURE_OPENAI_API_VERSION: {AZURE_API_VERSION}")

# Import Azure OpenAI SDK if available
try:
    from openai import AzureOpenAI
    print("Successfully imported Azure OpenAI SDK")
    AZURE_AVAILABLE = True
except ImportError as e:
    print(f"Warning: Azure OpenAI SDK not found: {e}")
    print("Will use algorithmic fallback for quiz generation")
    AZURE_AVAILABLE = False



def get_client():
    """Get the Azure OpenAI client"""
    if not AZURE_AVAILABLE:
        return None
        
    # Get deployment name from environment or use default
    deployment = os.environ.get("AZURE_OPENAI_DEPLOYMENT_QUIZ", "gpt-4-1")
    print(f"Creating Azure OpenAI client with deployment: {deployment}")
    
    return AzureOpenAI(
        api_key=AZURE_API_KEY,
        api_version=AZURE_API_VERSION,
        azure_endpoint=AZURE_ENDPOINT
    )

def clean_transcript(text: str) -> str:
    """Clean and normalize transcript text"""
    # Remove timestamps and speaker labels if they exist
    text = re.sub(r'\[\d{2}:\d{2}:\d{2}\]', '', text)
    text = re.sub(r'\(\d{2}:\d{2}\)', '', text)
    text = re.sub(r'^Speaker \d+: ', '', text, flags=re.MULTILINE)
    
    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text)
    text = text.strip()
    
    return text

def calculate_dynamic_question_count(
    transcript: str, 
    summary: str, 
    content_density: str = 'medium'
) -> int:
    """
    Calculate the optimal number of questions based on content length and complexity
    
    Args:
        transcript (str): The video transcript text
        summary (str): The video summary text
        content_density (str): 'low', 'medium', or 'high' - how many questions per content unit
        
    Returns:
        int: The calculated number of questions
    """
    # Clean the transcript
    cleaned_transcript = clean_transcript(transcript)
    
    # Calculate content metrics
    transcript_length = len(cleaned_transcript)
    summary_length = len(summary)
    
    # Count sentences in transcript
    sentences = re.split(r'[.!?]+', cleaned_transcript)
    sentence_count = len([s for s in sentences if len(s.strip()) > 20])
    
    # Count paragraphs (double line breaks)
    paragraphs = re.split(r'\n\s*\n', cleaned_transcript)
    paragraph_count = len([p for p in paragraphs if len(p.strip()) > 50])
    
    # Count unique words (complexity indicator)
    words = re.findall(r'\b\w+\b', cleaned_transcript.lower())
    unique_words = len(set(words))
    
    # Calculate content complexity score (0-100)
    complexity_score = min(100, (
        (sentence_count * 2) +  # More sentences = more content
        (paragraph_count * 3) +  # More paragraphs = more structure
        (unique_words / 10) +    # More unique words = more complexity
        (transcript_length / 100) # Longer transcript = more content
    ))
    
    # Base question count calculation
    base_questions = max(3, min(15, int(complexity_score / 10)))
    
    # Adjust based on content density preference
    density_multipliers = {
        'low': 0.6,      # Fewer questions
        'medium': 1.0,   # Standard amount
        'high': 1.4      # More questions
    }
    
    multiplier = density_multipliers.get(content_density, 1.0)
    question_count = max(3, min(20, int(base_questions * multiplier)))
    
    # Ensure we don't exceed the number of available sentences
    question_count = min(question_count, sentence_count)
    
    print(f"Content Analysis:")
    print(f"  Transcript length: {transcript_length} chars")
    print(f"  Summary length: {summary_length} chars")
    print(f"  Sentences: {sentence_count}")
    print(f"  Paragraphs: {paragraph_count}")
    print(f"  Unique words: {unique_words}")
    print(f"  Complexity score: {complexity_score:.1f}")
    print(f"  Content density: {content_density}")
    print(f"  Calculated questions: {question_count}")
    
    return question_count

def generate_algorithmic_questions(
    transcript: str, 
    title: str,
    summary: str,
    difficulty: str = 'medium',
    num_questions: int = 5,
    include_explanations: bool = True
) -> Dict[str, Any]:
    """
    Generate quiz questions using algorithmic approach as fallback
    
    Args:
        transcript (str): The video transcript text
        title (str): Video title
        summary (str): The video summary text
        difficulty (str): Difficulty level (easy, medium, hard)
        num_questions (int): Number of questions to generate
        include_explanations (bool): Whether to include explanations
        
    Returns:
        Dictionary with questions list
    """
    print(f"Generating {num_questions} algorithmic {difficulty} questions for '{title}'")
    
    # Clean the transcript
    cleaned_transcript = clean_transcript(transcript)
    
    # Split transcript into sentences
    sentences = re.split(r'[.!?]+', cleaned_transcript)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 20]  # Filter short sentences
    
    print(f"Raw sentences found: {len(sentences)}")
    
    # Process sentences to create usable chunks
    usable_chunks = []
    for sentence in sentences:
        if len(sentence) < 30:
            continue
            
        # For very long sentences, split them into smaller chunks
        if len(sentence) > 200:
            # Split long sentences into smaller chunks
            words = sentence.split()
            chunk_size = 50  # Target chunk size in words
            chunks = []
            
            for j in range(0, len(words), chunk_size):
                chunk = ' '.join(words[j:j + chunk_size])
                if len(chunk) > 30:  # Only keep chunks that are long enough
                    chunks.append(chunk)
            
            # Add all chunks, not just the first one
            usable_chunks.extend(chunks)
        else:
            usable_chunks.append(sentence)
    
    print(f"Filtered sentences (length > 20): {len(usable_chunks)}")
    
    if len(usable_chunks) < 1:
        print("Warning: Not enough content for algorithmic questions")
        print(f"Available chunks: {len(usable_chunks)}")
        # Create basic fallback questions even with limited content
        print("Creating basic fallback questions...")
        return create_basic_fallback_questions(title, summary, num_questions, difficulty, include_explanations)
    
    questions = []
    question_id = 1
    
    # Generate different types of questions
    question_types = ['multiple_choice', 'true_false']
    
    print(f"Starting question generation loop for {num_questions} questions")
    
    for i in range(min(num_questions, len(usable_chunks))):
        sentence = usable_chunks[i]
        
        if question_id > num_questions:
            break
            
        print(f"Processing sentence {i+1}: '{sentence[:50]}...'")
        
        # Skip very short sentences
        if len(sentence) < 30:
            print(f"Skipping sentence {i+1}: length {len(sentence)} (too short)")
            continue
            
        # Skip very long sentences (shouldn't happen after chunking, but just in case)
        if len(sentence) > 200:
            print(f"Skipping sentence {i+1}: length {len(sentence)} (too long)")
            continue
            
                    # Generate multiple choice question
            if question_types[i % len(question_types)] == 'multiple_choice':
                # Extract key concepts from the sentence
                words = sentence.split()
                if len(words) < 5:
                    continue
                    
                # Find a key word to ask about
                key_words = [w for w in words if len(w) > 4 and w.lower() not in ['about', 'which', 'their', 'there', 'these', 'those', 'learning', 'machine', 'artificial', 'intelligence']]
                if not key_words:
                    continue
                    
                key_word = random.choice(key_words)
                
                # Create more specific question based on the sentence content
                if 'machine learning' in sentence.lower():
                    question_text = f"According to the video, what is machine learning?"
                    correct_option = "A field of study that gives computers the ability to learn without being explicitly programmed"
                    incorrect_options = [
                        "A type of computer hardware",
                        "A programming language",
                        "A database management system"
                    ]
                elif 'data mining' in sentence.lower():
                    question_text = f"What is the main purpose of data mining as described in the video?"
                    correct_option = "To extract data for human comprehension"
                    incorrect_options = [
                        "To store data in databases",
                        "To delete unnecessary data",
                        "To encrypt sensitive information"
                    ]
                else:
                    # Create a more contextual question
                    question_text = f"Which of the following best describes the concept of '{key_word}' mentioned in the video?"
                    correct_option = f"A key concept related to the main topic of the video"
                    incorrect_options = [
                        f"An unrelated technology not discussed",
                        f"A programming language",
                        f"A hardware component"
                    ]
                
                options = [correct_option] + incorrect_options
                random.shuffle(options)
                
                # Find correct answer index
                correct_index = options.index(correct_option)
                correct_answer = chr(ord('a') + correct_index)
                
                # Create options with explanations
                options_data = []
                for j, option in enumerate(options):
                    option_id = chr(ord('a') + j)
                    if option == correct_option:
                        explanation = f"This is correct because it accurately describes the concept as presented in the video."
                    else:
                        explanation = f"This is incorrect because it does not match what was discussed in the video."
                    
                    options_data.append({
                        "id": option_id,
                        "text": option,
                        "explanation": explanation
                    })
            
            questions.append({
                "id": question_id,
                "question": question_text,
                "options": options_data,
                "correctAnswer": correct_answer,
                "difficulty": difficulty,
                "questionType": "multiple_choice",
                "timestamp": random.randint(30, 300)  # Random timestamp
            })
            
        else:  # true_false
            # Create a true/false question based on the sentence
            question_text = f"The video discusses {sentence[:50]}..."
            
            # Randomly decide if it's true or false
            is_true = random.choice([True, False])
            
            options_data = [
                {
                    "id": "a",
                    "text": "True",
                    "explanation": "This is correct because the video does discuss this topic." if is_true else "This is incorrect because the video does not discuss this topic."
                },
                {
                    "id": "b", 
                    "text": "False",
                    "explanation": "This is incorrect because the video does discuss this topic." if is_true else "This is correct because the video does not discuss this topic."
                }
            ]
            
            questions.append({
                "id": question_id,
                "question": question_text,
                "options": options_data,
                "correctAnswer": "a" if is_true else "b",
                "difficulty": difficulty,
                "questionType": "true_false",
                "timestamp": random.randint(30, 300)  # Random timestamp
            })
            
        question_id += 1
    
    print(f"Generated {len(questions)} algorithmic questions")
    return {"questions": questions}

def create_basic_fallback_questions(
    title: str,
    summary: str,
    num_questions: int = 3,
    difficulty: str = 'medium',
    include_explanations: bool = True
) -> Dict[str, Any]:
    """
    Create basic fallback questions when other generation methods fail
    
    Args:
        title (str): Video title
        summary (str): The video summary text
        num_questions (int): Number of questions to generate
        difficulty (str): Difficulty level
        include_explanations (bool): Whether to include explanations
        
    Returns:
        Dictionary with questions list
    """
    print(f"Creating {num_questions} basic fallback questions for '{title}'")
    
    questions = []
    
    # Create simple true/false questions based on the summary
    summary_sentences = re.split(r'[.!?]+', summary)
    summary_sentences = [s.strip() for s in summary_sentences if len(s.strip()) > 10]
    
    for i in range(min(num_questions, len(summary_sentences))):
        sentence = summary_sentences[i]
        
        # Create a true/false question
        question_text = f"The video discusses: {sentence[:100]}..."
        
        options_data = [
            {
                "id": "a",
                "text": "True",
                "explanation": "This is correct because the video does discuss this topic." if include_explanations else ""
            },
            {
                "id": "b", 
                "text": "False",
                "explanation": "This is incorrect because the video does discuss this topic." if include_explanations else ""
            }
        ]
        
        questions.append({
            "id": i + 1,
            "question": question_text,
            "options": options_data,
            "correctAnswer": "a",  # Always true since we're using actual summary content
            "difficulty": difficulty,
            "questionType": "true_false",
            "timestamp": random.randint(30, 300)  # Random timestamp
        })
    
    # If we don't have enough summary sentences, create generic questions
    while len(questions) < num_questions:
        question_text = f"This video is about: {title}"
        
        options_data = [
            {
                "id": "a",
                "text": "The topic mentioned in the title",
                "explanation": "This is correct because the video title indicates the main topic." if include_explanations else ""
            },
            {
                "id": "b", 
                "text": "A completely different topic",
                "explanation": "This is incorrect because the video title clearly indicates the topic." if include_explanations else ""
            }
        ]
        
        questions.append({
            "id": len(questions) + 1,
            "question": question_text,
            "options": options_data,
            "correctAnswer": "a",
            "difficulty": difficulty,
            "questionType": "true_false",
            "timestamp": random.randint(30, 300)
        })
    
    print(f"Created {len(questions)} basic fallback questions")
    return {"questions": questions}

def generate_questions(
    transcript: str, 
    title: str,
    summary: str,
    difficulty: str = 'medium',
    content_density: str = 'medium',
    include_explanations: bool = True
) -> Dict[str, Any]:
    """
    Generate quiz questions using Azure OpenAI with algorithmic fallback
    
    Args:
        transcript (str): The video transcript text
        title (str): Video title
        summary (str): The video summary text
        difficulty (str): Difficulty level (easy, medium, hard)
        content_density (str): Content density level (low, medium, high)
        include_explanations (bool): Whether to include explanations
        
    Returns:
        Dictionary with questions list
    """
    # Calculate dynamic question count based on content
    num_questions = calculate_dynamic_question_count(transcript, summary, content_density)
    
    print(f"Generating {num_questions} {difficulty} difficulty questions for '{title}' (content density: {content_density})")
    
    # Try AI generation first if available
    if AZURE_AVAILABLE and AZURE_API_KEY and AZURE_ENDPOINT:
        try:
            # Get the Azure OpenAI client
            client = get_client()
            
            # Clean the transcript
            cleaned_transcript = clean_transcript(transcript)
            print(f"Transcript length: {len(transcript)} chars, cleaned: {len(cleaned_transcript)} chars")
            
            # Process long transcripts to get questions from throughout the video
            max_length = 12000  # Increased limit to get more content
            if len(cleaned_transcript) > max_length:
                # Take beginning, middle and end portions to cover the whole video
                third_length = max_length // 3
                beginning = cleaned_transcript[:third_length]
                middle_start = len(cleaned_transcript)//2 - third_length//2
                middle = cleaned_transcript[middle_start:middle_start + third_length]
                end = cleaned_transcript[-third_length:]
                cleaned_transcript = beginning + "\n...\n" + middle + "\n...\n" + end
                print(f"Processed transcript into beginning/middle/end sections, total length: {len(cleaned_transcript)} chars")
            
            # Create system prompt based on difficulty
            difficulty_descriptions = {
                'easy': "Create simple, straightforward questions that test basic understanding of the main concepts.",
                'medium': "Create moderately challenging questions that require understanding of key concepts and some details.",
                'hard': "Create challenging questions that test deep understanding of concepts, relationships, and nuances."
            }
            
            # Question type descriptions
            question_types = {
                'multiple_choice': "Traditional multiple-choice questions with one correct answer",
                'multiple_answer': "Questions with multiple correct answers to select",
                'true_false': "True or false statements about the content"
            }
            
            # Build the system prompt
            system_prompt = f"""
            You are an expert quiz creator for educational videos. Your task is to generate a JSON-formatted quiz with {num_questions} questions based on the provided video summary and transcript.

            **CRITICAL INSTRUCTIONS:**

            1.  **Role**: Act as an expert quiz creator, crafting questions that are insightful and test a user's understanding of the video content.
            2.  **Primary Source**: You MUST use the **video summary** as the primary source for creating questions. The transcript is provided only for context and to help you find specific details when needed.
            3.  **NO GENERIC QUESTIONS**: Do NOT generate generic or templated questions. Every question must be specific to the content of the video summary. Avoid questions like "What is the main topic of the video?" or "Which of the following was mentioned?"
            4.  **Insightful Questions**: Create questions that test the user's understanding of the concepts, relationships, and key takeaways presented in the summary. Questions should be verbose and clear.
            5.  **Plausible Distractors**: For multiple-choice questions, the incorrect options (distractors) must be plausible and related to the topic, but clearly wrong based on the video content. Do not use obviously unrelated options.
            6.  **Objective**: Generate {num_questions} engaging and accurate quiz questions that reflect the key points of the summary.
            7.  **Difficulty**: The difficulty level for the quiz is **{difficulty}**.
            8.  **Question Types**: Include a mix of `multiple_choice`, `multiple_answer`, and `true_false`.
            9.  **Explanations per Option**: For each question, provide a unique `explanation` for **every single option**.
                - If an option is **correct**, the explanation should confirm it and briefly state why.
                - If an option is **incorrect**, the explanation must explain *why that specific option is wrong* based on the transcript.
                - **CRUCIAL**: When explaining an incorrect option, **DO NOT reveal the correct answer**. Guide the user to reconsider.
            10. **Timestamps**: Provide an estimated `timestamp` (in seconds) for each question, corresponding to the moment in the video where the answer can be found.

            **CRITICAL JSON FORMAT REQUIREMENTS:**

            - Return ONLY valid JSON with no additional text before or after
            - Use double quotes for all strings
            - Ensure all JSON syntax is correct (no trailing commas, proper escaping)
            - The response must be parseable by JSON.parse()

            **JSON Output Format:**

            {{
              "questions": [
                {{
                  "id": 1,
                  "question": "Your question here.",
                  "options": [
                    {{"id": "a", "text": "Option A", "explanation": "Explanation for why Option A is correct or incorrect."}},
                    {{"id": "b", "text": "Option B", "explanation": "Explanation for why Option B is correct or incorrect."}},
                    {{"id": "c", "text": "Option C", "explanation": "Explanation for why Option C is correct or incorrect."}},
                    {{"id": "d", "text": "Option D", "explanation": "Explanation for why Option D is correct or incorrect."}}
                  ],
                  "correctAnswer": "a",
                  "difficulty": "{difficulty}",
                  "questionType": "multiple_choice",
                  "timestamp": 120
                }}
              ]
            }}

            **Important:**

            *   Return **only** the JSON object with no markdown formatting, no code blocks, no additional text.
            *   Ensure every option within a question has its own `explanation` field.
            *   Validate your JSON before returning it.
            """
            
            # Build the user prompt
            user_prompt = f"""
            Generate a quiz for the following video:
            
            Title: {title}
            
            Summary:
            {summary}
            
            Transcript:
            {cleaned_transcript}
            
            Create {num_questions} questions of {difficulty} difficulty based on the summary.
            """
            
            # Use GPT-4 deployment from Azure - use the same deployment as in summarization
            deployment = os.environ.get("AZURE_OPENAI_DEPLOYMENT_QUIZ", "gpt-4-1")  # Get deployment name from environment or use default
            
            print(f"Sending request to Azure OpenAI with deployment: {deployment}")
            print(f"System prompt length: {len(system_prompt)} chars")
            print(f"User prompt length: {len(user_prompt)} chars")
            
            # Make the API call to Azure
            print(f"Making API call to Azure OpenAI...")
            try:
                response = client.chat.completions.create(
                    model=deployment,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    temperature=0.5,
                    max_tokens=2000
                )
                print(f"API call successful, response received")
            except Exception as api_error:
                print(f"Azure OpenAI API call failed: {api_error}")
                raise api_error
            
            response_text = response.choices[0].message.content
            print(f"Received response of length: {len(response_text)} chars")
            print(f"Response preview: {response_text[:500]}...")
            
            # Process and return the questions
            try:
                # Try multiple JSON extraction strategies
                json_str = None
                
                # Strategy 1: Look for JSON between curly braces
                json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', response_text, re.DOTALL)
                if json_match:
                    json_str = json_match.group(0)
                    print(f"Strategy 1: Extracted JSON string length: {len(json_str)}")
                    
                    # Try to validate the JSON structure
                    try:
                        test_parse = json.loads(json_str)
                        if 'questions' in test_parse and isinstance(test_parse['questions'], list):
                            print("Strategy 1: Valid JSON with questions found")
                        else:
                            print("Strategy 1: JSON found but no valid questions structure")
                            json_str = None
                    except json.JSONDecodeError:
                        print("Strategy 1: Invalid JSON, trying next strategy")
                        json_str = None
                
                # Strategy 2: Look for JSON after "```json" or "```"
                if not json_str:
                    json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', response_text, re.DOTALL)
                    if json_match:
                        json_str = json_match.group(1)
                        print(f"Strategy 2: Extracted JSON string length: {len(json_str)}")
                
                # Strategy 3: Look for any JSON-like structure
                if not json_str:
                    json_match = re.search(r'\{[^{}]*"questions"[^{}]*\[.*?\]', response_text, re.DOTALL)
                    if json_match:
                        # Find the complete JSON object
                        start = json_match.start()
                        brace_count = 0
                        end = start
                        for i, char in enumerate(response_text[start:], start):
                            if char == '{':
                                brace_count += 1
                            elif char == '}':
                                brace_count -= 1
                                if brace_count == 0:
                                    end = i + 1
                                    break
                        json_str = response_text[start:end]
                        print(f"Strategy 3: Extracted JSON string length: {len(json_str)}")
                
                if json_str:
                    print(f"JSON preview: {json_str[:300]}...")
                    
                    # Try to parse the JSON
                    try:
                        questions_data = json.loads(json_str)
                    except json.JSONDecodeError as parse_error:
                        print(f"JSON parse error: {parse_error}")
                        # Try to fix common JSON issues
                        json_str = json_str.replace('\n', ' ').replace('\r', ' ')
                        json_str = re.sub(r',\s*}', '}', json_str)  # Remove trailing commas
                        json_str = re.sub(r',\s*]', ']', json_str)  # Remove trailing commas in arrays
                        
                        # Try to fix unescaped quotes in strings
                        json_str = re.sub(r'(?<!\\)"(?=.*")', '\\"', json_str)
                        
                        try:
                            questions_data = json.loads(json_str)
                        except json.JSONDecodeError as second_error:
                            print(f"Second JSON parse error: {second_error}")
                            # Try one more time with more aggressive cleaning
                            json_str = re.sub(r'[^\x20-\x7E]', '', json_str)  # Remove non-printable characters
                            questions_data = json.loads(json_str)
                    
                    # Ensure we have the right structure
                    if 'questions' not in questions_data or not isinstance(questions_data['questions'], list):
                        print("Error: Invalid response format from AI")
                        print(f"Response: {response_text[:200]}...")
                        print("Attempting to fix response format...")
                        
                        # Try to fix the response by looking for questions array
                        if isinstance(questions_data, dict) and len(questions_data) > 0:
                            # If the response is a dict but doesn't have 'questions', try to find the questions
                            for key, value in questions_data.items():
                                if isinstance(value, list) and len(value) > 0:
                                    if all(isinstance(item, dict) and 'question' in item for item in value):
                                        questions_data = {'questions': value}
                                        print("Fixed response format by finding questions array")
                                        break
                        
                        if 'questions' not in questions_data or not isinstance(questions_data['questions'], list):
                            raise ValueError("Invalid AI response format")
                    
                    if len(questions_data['questions']) == 0:
                        print("Error: AI generated no questions")
                        raise ValueError("AI generated no questions")
                    
                    print(f"Successfully generated {len(questions_data['questions'])} questions")
                    return questions_data
                else:
                    print("Error: Could not extract JSON from AI response")
                    print(f"Response: {response_text[:500]}...")
                    raise ValueError("Could not extract JSON from AI response")
            except json.JSONDecodeError as e:
                print(f"Error decoding JSON: {e}")
                print(f"AI response: {response_text[:500]}...")
                raise ValueError("Failed to decode AI response JSON")
            except Exception as e:
                print(f"Unexpected error processing questions: {e}")
                raise e
                
        except Exception as e:
            print(f"AI generation failed: {e}")
            print("Falling back to algorithmic generation...")
    
    # Fallback to algorithmic generation
    print("Using algorithmic fallback for quiz generation")
    return generate_algorithmic_questions(
        transcript, title, summary, difficulty, num_questions, include_explanations
    )

def main():
    """Main entry point for the script"""
    print("Starting quiz generator script...")
    
    parser = argparse.ArgumentParser(description="Generate quiz questions from video transcript")
    parser.add_argument("transcript_file", help="Path to transcript file")
    parser.add_argument("video_title", help="Title of the video")
    parser.add_argument("summary_file", help="Path to summary file")
    parser.add_argument("--difficulty", choices=["easy", "medium", "hard"], default="medium", help="Difficulty level")
    parser.add_argument("--content-density", choices=["low", "medium", "high"], default="medium", help="Content density level")
    parser.add_argument("--include-explanations", type=str, choices=["true", "false"], default="true", 
                        help="Whether to include explanations")
    
    args = parser.parse_args()
    
    print(f"\n{'='*40}\nQUIZ GENERATOR\n{'='*40}")
    print(f"Received arguments: {args}")
    print(f"Arguments: difficulty={args.difficulty}, content_density={args.content_density}, explanations={args.include_explanations}")
    
    # Read transcript
    try:
        print(f"Reading transcript file: {args.transcript_file}")
        print(f"Transcript file exists: {os.path.exists(args.transcript_file)}")
        with open(args.transcript_file, 'r', encoding='utf-8') as f:
            transcript = f.read()
        print(f"Transcript loaded: {len(transcript)} characters")
    except Exception as e:
        print(f"Error reading transcript file: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

    # Read summary
    try:
        print(f"Reading summary file: {args.summary_file}")
        print(f"Summary file exists: {os.path.exists(args.summary_file)}")
        with open(args.summary_file, 'r', encoding='utf-8') as f:
            summary = f.read()
        print(f"Summary loaded: {len(summary)} characters")
    except Exception as e:
        print(f"Error reading summary file: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    # Generate questions
    include_explanations = args.include_explanations.lower() == "true"
    
    try:
        print("Generating quiz questions...")
        print(f"Calling generate_questions with transcript length: {len(transcript)}")
        print(f"Calling generate_questions with summary length: {len(summary)}")
        
        questions_data = generate_questions(
            transcript, 
            args.video_title,
            summary,
            args.difficulty,
            args.content_density,
            include_explanations
        )
        
        print(f"generate_questions returned: {questions_data}")
        
        # Validate questions data
        if not questions_data or 'questions' not in questions_data or not questions_data['questions']:
            print(f"Questions data validation failed:")
            print(f"  questions_data: {questions_data}")
            print(f"  'questions' in questions_data: {'questions' in questions_data}")
            if 'questions' in questions_data:
                print(f"  len(questions_data['questions']): {len(questions_data['questions'])}")
            print("Falling back to basic question generation...")
            questions_data = create_basic_fallback_questions(
                args.video_title, summary, 3, args.difficulty, include_explanations
            )
        
        print(f"\n{'='*40}\nGENERATED QUIZ\n{'='*40}")
        print(f"Successfully generated {len(questions_data['questions'])} questions")
        
        # Log the timestamps for each question
        print("\nQuestion timestamps before API response:")
        if 'questions' in questions_data and questions_data['questions']:
            for i, q in enumerate(questions_data['questions']):
                timestamp = q.get('timestamp', 'not set')
                print(f"Question {i+1}: {timestamp}s - \"{q['question'][:50]}...\"")
        
        # Output the questions as JSON
        print(json.dumps(questions_data, indent=2))
        
    except Exception as e:
        print(f"Error generating questions: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()