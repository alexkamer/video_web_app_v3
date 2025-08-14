#!/usr/bin/env python3
"""
Standalone script to correct transcript text using Agno agents
"""

import os
import sys
import asyncio
import argparse

# Make sure parent directory is in path for imports
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.append(parent_dir)

from transcript_summarizer.summarizer import TranscriptSummarizer

async def correct_transcript_background_async(transcript_text, video_title):
    """
    Async function to correct a transcript in the background
    
    Args:
        transcript_text (str): The transcript to correct
        video_title (str): The title of the video
        
    Returns:
        str: The corrected transcript
    """
    summarizer = TranscriptSummarizer()
    return await summarizer.correct_transcript_async(transcript_text, video_title)

def correct_transcript_background(transcript_text, video_title):
    """
    Synchronous wrapper for correcting a transcript in the background
    
    Args:
        transcript_text (str): The transcript to correct
        video_title (str): The title of the video
        
    Returns:
        str: The corrected transcript
    """
    return asyncio.run(correct_transcript_background_async(transcript_text, video_title))

def main():
    """Main entry point for the script"""
    parser = argparse.ArgumentParser(description="Correct transcript errors using Agno agents")
    parser.add_argument("transcript_file", help="Path to the transcript file")
    parser.add_argument("video_title", help="Title of the video")
    
    args = parser.parse_args()
    
    # Read transcript file
    try:
        with open(args.transcript_file, 'r', encoding='utf-8') as f:
            transcript_text = f.read().strip()
    except FileNotFoundError:
        print(f"Error: Transcript file '{args.transcript_file}' not found.")
        sys.exit(1)
    except Exception as e:
        print(f"Error reading transcript file: {e}")
        sys.exit(1)
    
    if not transcript_text:
        print("Error: Transcript file is empty.")
        sys.exit(1)
    
    print(f"Correcting transcript for video: {args.video_title}")
    print(f"Transcript length: {len(transcript_text)} characters")
    
    # Run transcript correction
    corrected_transcript = correct_transcript_background(transcript_text, args.video_title)
    
    # Print the corrected transcript
    print("\n" + "="*50)
    print("CORRECTED TRANSCRIPT")
    print("="*50)
    print(corrected_transcript)
    print("="*50)

if __name__ == "__main__":
    main()