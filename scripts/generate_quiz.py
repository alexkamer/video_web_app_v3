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

if not AZURE_API_KEY or not AZURE_ENDPOINT:
    print("Error: Azure OpenAI credentials not found in environment variables")
    print(f"API Key: {'set' if AZURE_API_KEY else 'not set'}, Endpoint: {'set' if AZURE_ENDPOINT else 'not set'}")
    sys.exit(1)

try:
    # Import Azure OpenAI SDK
    from openai import AzureOpenAI
    print("Successfully imported Azure OpenAI SDK")
except ImportError as e:
    print(f"Error: Required Azure OpenAI SDK not found: {e}")
    print("Please install with: uv add openai azure-identity")
    sys.exit(1)

def get_client():
    """Get the Azure OpenAI client"""
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

def generate_questions(
    transcript: str, 
    title: str,
    summary: str,
    difficulty: str = 'medium',
    num_questions: int = 5,
    include_explanations: bool = True
) -> Dict[str, Any]:
    """
    Generate quiz questions using Azure OpenAI
    
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
    print(f"Generating {num_questions} {difficulty} difficulty questions for '{title}'")
    
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

    **JSON Output Format:**

    ```json
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
    ```

    **Important:**

    *   Return **only** the JSON object.
    *   Ensure every option within a question has its own `explanation` field.
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
    
    try:
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
            # Extract the JSON part
            json_match = re.search(r'{{.*}}', response_text, re.DOTALL)
            if json_match:
                json_str = json_match.group(0)
                print(f"Extracted JSON string length: {len(json_str)}")
                print(f"JSON preview: {json_str[:300]}...")
                
                questions_data = json.loads(json_str)
                
                # Ensure we have the right structure
                if 'questions' not in questions_data or not isinstance(questions_data['questions'], list):
                    print("Error: Invalid response format from AI")
                    print(f"Response: {response_text[:200]}...")
                    return {"questions": []}
                
                print(f"Successfully generated {len(questions_data['questions'])} questions")
                return questions_data
            else:
                print("Error: Could not extract JSON from AI response")
                print(f"Response: {response_text[:200]}...")
                return {"questions": []}
        except json.JSONDecodeError as e:
            print(f"Error decoding JSON: {e}")
            print(f"AI response: {response_text[:500]}...")
            return {"questions": []}
        except Exception as e:
            print(f"Unexpected error processing questions: {e}")
            return {"questions": []}
            
    except Exception as e:
        print(f"Error calling Azure OpenAI: {e}")
        print("Falling back to generated questions")
        return {"questions": []}



def main():
    """Main entry point for the script"""
    print("Starting quiz generator script...")
    
    parser = argparse.ArgumentParser(description="Generate quiz questions from video transcript")
    parser.add_argument("transcript_file", help="Path to transcript file")
    parser.add_argument("video_title", help="Title of the video")
    parser.add_argument("summary_file", help="Path to summary file")
    parser.add_argument("--difficulty", choices=["easy", "medium", "hard"], default="medium", help="Difficulty level")
    parser.add_argument("--num-questions", type=int, default=5, help="Number of questions to generate")
    parser.add_argument("--include-explanations", type=str, choices=["true", "false"], default="true", 
                        help="Whether to include explanations")
    
    args = parser.parse_args()
    
    print(f"\n{'='*40}\nQUIZ GENERATOR\n{'='*40}")
    print(f"Received arguments: {args}")
    print(f"Arguments: difficulty={args.difficulty}, questions={args.num_questions}, explanations={args.include_explanations}")
    
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
        print("Generating quiz questions using Azure OpenAI...")
        print(f"Calling generate_questions with transcript length: {len(transcript)}")
        print(f"Calling generate_questions with summary length: {len(summary)}")
        
        questions_data = generate_questions(
            transcript, 
            args.video_title,
            summary,
            args.difficulty,
            args.num_questions,
            include_explanations
        )
        
        print(f"generate_questions returned: {questions_data}")
        
        # If no questions were generated, raise an error
        if not questions_data or 'questions' not in questions_data or not questions_data['questions']:
            print(f"Questions data validation failed:")
            print(f"  questions_data: {questions_data}")
            print(f"  'questions' in questions_data: {'questions' in questions_data}")
            if 'questions' in questions_data:
                print(f"  len(questions_data['questions']): {len(questions_data['questions'])}")
            raise ValueError("AI failed to generate questions.")
        
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