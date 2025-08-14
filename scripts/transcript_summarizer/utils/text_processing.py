"""
Utility functions for text processing in transcript summarization
"""

import gc
import re
import json

def create_overlapping_chunks(text, chunk_size=4000, overlap=800, max_chunks=20):
    """Create overlapping chunks from text with memory safeguards
    
    Args:
        text (str): The input text to chunk
        chunk_size (int): Maximum size of each chunk in characters
        overlap (int): Overlap size between adjacent chunks in characters
        max_chunks (int): Maximum number of chunks to create (memory safety)
        
    Returns:
        list: List of text chunks
    """
    if not text:
        return []
    
    # Defensive check for input types
    if not isinstance(text, str):
        print(f"Warning: Expected string input but got {type(text)}, converting to string")
        text = str(text)
    
    # Memory safety - limit maximum text size
    MAX_TEXT_SIZE = 1000000  # ~1MB text
    if len(text) > MAX_TEXT_SIZE:
        print(f"Warning: Input text exceeds {MAX_TEXT_SIZE/1000000:.1f}MB. Truncating to prevent memory issues.")
        text = text[:MAX_TEXT_SIZE]
    
    # Adaptive chunk size for very large texts
    original_chunk_size = chunk_size
    original_overlap = overlap
    estimated_chunks = len(text) / (chunk_size - overlap)
    
    if estimated_chunks > max_chunks:
        # Reduce overlap and increase chunk size to handle large texts
        # with fewer chunks to prevent memory issues
        new_chunk_size = int(len(text) / max_chunks) + overlap
        new_overlap = min(overlap, int(new_chunk_size * 0.1))  # 10% overlap maximum
        
        print(f"Input too large. Adjusting chunk size from {chunk_size} to {new_chunk_size} "
              f"and overlap from {overlap} to {new_overlap} to limit to {max_chunks} chunks.")
        
        chunk_size = new_chunk_size
        overlap = new_overlap
    
    chunks = []
    start = 0
    chunk_count = 0
    
    while start < len(text) and chunk_count < max_chunks:
        # Memory safety - monitor and force garbage collection
        if chunk_count > 0 and chunk_count % 5 == 0:
            gc.collect()
        
        end = start + chunk_size
        
        # If this isn't the last chunk, try to break at a word or sentence boundary
        if end < len(text):
            # First try to find a sentence boundary (period followed by space)
            period_pos = text.rfind('. ', start, end)
            if period_pos > start + chunk_size // 2:
                end = period_pos + 1  # Include the period
            else:
                # Fall back to word boundary
                last_space = text.rfind(' ', start, end)
                if last_space > start + chunk_size // 2:  # Only break at space if it's not too early
                    end = last_space
        
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
            chunk_count += 1
        
        # Move start position, accounting for overlap
        start = end - overlap
        if start >= len(text):
            break
    
    # Memory safety - if we hit the chunk limit but haven't processed all text
    if start < len(text) and chunk_count >= max_chunks:
        print(f"Warning: Text too large, only processed {chunk_count} chunks "
              f"({start} of {len(text)} characters). Summary may be incomplete.")
    
    return chunks

def generate_basic_summary(transcript_text, video_title):
    """Generate a basic summary as fallback with memory safeguards
    
    Args:
        transcript_text (str): The transcript text to summarize
        video_title (str): The title of the video
        
    Returns:
        str: A basic summary of the transcript
    """
    try:
        # Memory safety - ensure input is not too large
        MAX_LENGTH = 100000  # ~100KB max for fallback
        if len(transcript_text) > MAX_LENGTH:
            print(f"Truncating transcript from {len(transcript_text)} to {MAX_LENGTH} characters for fallback summary")
            transcript_text = transcript_text[:MAX_LENGTH]
            
        # Clean up any potential issues with the text
        transcript_text = transcript_text.replace('\x00', '')
        
        # Create a simple summary with first part of text
        preview_length = min(1000, len(transcript_text))
        summary = f"🎬 {video_title}\n\n**Basic Summary**\n\n{transcript_text[:preview_length]}"
        
        if len(transcript_text) > preview_length:
            summary += "..."
            
        # Add word count information
        word_count = len(transcript_text.split())
        summary += f"\n\n*Transcript contains approximately {word_count} words.*"
        
        return summary
        
    except Exception as e:
        # Ultimate fallback in case of any errors
        print(f"Error in generate_basic_summary: {e}")
        return f"🎬 {video_title}\n\n**Basic Summary**\n\nUnable to generate summary due to an error."

def extract_json_from_text(text):
    """Extract a JSON object from text using regex patterns
    
    Args:
        text (str): Text containing a JSON object
        
    Returns:
        dict: Extracted JSON object or default dict if extraction fails
    """
    try:
        # Find JSON in the response content
        json_match = re.search(r'\{\s*"genre"\s*:\s*"[^"]+"\s*,\s*"content_type"\s*:\s*"[^"]+"\s*\}', text)
        if json_match:
            return json.loads(json_match.group(0))
        else:
            # Try extracting any JSON-like structure
            json_match = re.search(r'\{[^\}]+\}', text)
            if json_match:
                return json.loads(json_match.group(0))
    except (json.JSONDecodeError, AttributeError) as e:
        print(f"Error parsing JSON: {e}")
    
    # Return default if all extraction methods fail
    return {"genre": "educational", "content_type": "informational"}