"""
Fast summarization functionality for quick, concise summaries

This module provides a streamlined approach to summarizing transcripts
that prioritizes speed and conciseness over detailed analysis.
"""

import os
import time
from typing import Dict, Optional
from openai import AzureOpenAI
import dotenv

# Load environment variables
dotenv.load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '.env.local'))

def estimate_video_duration(transcript_length: int) -> int:
    """Estimate video duration in minutes based on transcript length
    
    Args:
        transcript_length (int): Length of transcript in characters
        
    Returns:
        int: Estimated duration in minutes
    """
    # Rough estimate: 150-200 characters per minute of speech
    chars_per_minute = 175
    duration_minutes = transcript_length / chars_per_minute
    return max(1, int(duration_minutes))

def calculate_target_length(duration_minutes: int) -> int:
    """Calculate target word count based on video duration
    
    Args:
        duration_minutes (int): Video duration in minutes
        
    Returns:
        int: Target word count for summary
    """
    if duration_minutes < 5:
        return 75  # Short videos: 50-100 words
    elif duration_minutes < 15:
        return 150  # Medium videos: 100-200 words
    else:
        return 250  # Long videos: 200-300 words

def load_fast_summary_prompt() -> str:
    """Load the fast summary prompt template
    
    Returns:
        str: The prompt template
    """
    prompt_path = os.path.join(os.path.dirname(__file__), 'templates', 'fast_summary_prompt.txt')
    try:
        with open(prompt_path, 'r', encoding='utf-8') as f:
            return f.read().strip()
    except FileNotFoundError:
        # Fallback prompt if template file is missing
        return """Create a concise summary of this video transcript in {target_length} words or less. Focus on key points and avoid filler words.

Transcript:
{transcript_text}"""

def generate_fast_summary(transcript_text: str, video_title: str, debug_output: bool = False) -> str:
    """Generate a fast, concise summary of the transcript
    
    Args:
        transcript_text (str): The transcript text to summarize
        video_title (str): Title of the video
        debug_output (bool): Whether to print debug information
        
    Returns:
        str: The generated summary
    """
    if not transcript_text or not video_title:
        return "Unable to generate summary: missing transcript or title."
    
    start_time = time.time()
    
    try:
        # Initialize Azure OpenAI client
        client = AzureOpenAI(
            api_key=os.getenv('AZURE_OPENAI_API_KEY'),
            api_version=os.getenv('AZURE_OPENAI_API_VERSION', '2024-12-01-preview'),
            azure_endpoint=os.getenv('AZURE_OPENAI_ENDPOINT')
        )
        
        # Calculate target length based on transcript length
        transcript_length = len(transcript_text)
        estimated_duration = estimate_video_duration(transcript_length)
        target_length = calculate_target_length(estimated_duration)
        
        if debug_output:
            print(f"Fast Summary: Transcript length: {transcript_length} chars")
            print(f"Fast Summary: Estimated duration: {estimated_duration} minutes")
            print(f"Fast Summary: Target length: {target_length} words")
        
        # Load and format the prompt
        prompt_template = load_fast_summary_prompt()
        formatted_prompt = prompt_template.format(
            video_title=video_title,
            transcript_length=transcript_length,
            target_length=target_length,
            transcript_text=transcript_text
        )
        
        # Truncate transcript if it's too long for the API
        max_tokens = 120000  # Conservative limit for GPT-4
        if len(formatted_prompt) > max_tokens:
            # Keep the prompt structure and truncate the transcript
            prompt_start = formatted_prompt[:formatted_prompt.find('```') + 3]
            prompt_end = formatted_prompt[formatted_prompt.rfind('```'):]
            
            # Calculate how much transcript we can include
            available_space = max_tokens - len(prompt_start) - len(prompt_end) - 100
            truncated_transcript = transcript_text[:available_space] + "\n\n[Transcript truncated for length]"
            
            formatted_prompt = prompt_start + "\n" + truncated_transcript + "\n" + prompt_end
            
            if debug_output:
                print(f"Fast Summary: Transcript truncated to {len(truncated_transcript)} chars")
        
        # Generate summary using Azure OpenAI
        response = client.chat.completions.create(
            model=os.getenv('AZURE_OPENAI_DEPLOYMENT', 'gpt-4-1'),
            messages=[
                {"role": "system", "content": "You are a concise content summarizer. Provide direct, factual summaries without filler words."},
                {"role": "user", "content": formatted_prompt}
            ],
            temperature=0.3,  # Lower temperature for more consistent, factual output
            max_tokens=500,   # Limit output length
            timeout=30        # 30 second timeout for faster response
        )
        
        summary = response.choices[0].message.content.strip()
        
        # Calculate processing time
        processing_time = time.time() - start_time
        
        if debug_output:
            print(f"Fast Summary: Generated in {processing_time:.2f} seconds")
            print(f"Fast Summary: Summary length: {len(summary)} chars")
        
        return summary
        
    except Exception as e:
        if debug_output:
            print(f"Fast Summary: Error generating summary: {e}")
        
        # Fallback: return a basic extractive summary
        words = transcript_text.split()
        if len(words) > 100:
            # Take first 100 words as a basic summary
            basic_summary = " ".join(words[:100]) + "..."
        else:
            basic_summary = transcript_text
            
        return f"Summary unavailable. Here's the beginning of the transcript:\n\n{basic_summary}"

def generate_fast_summary_async(transcript_text: str, video_title: str, debug_output: bool = False) -> str:
    """Async wrapper for generate_fast_summary (for compatibility)
    
    Args:
        transcript_text (str): The transcript text to summarize
        video_title (str): Title of the video
        debug_output (bool): Whether to print debug information
        
    Returns:
        str: The generated summary
    """
    # For now, just call the sync version
    # In the future, this could be made truly async
    return generate_fast_summary(transcript_text, video_title, debug_output)
