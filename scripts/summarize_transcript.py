#!/usr/bin/env python3
"""
Transcript Summarization Script using Agno agents

This script uses Agno agents to summarize video transcripts with async support.
This is a refactored version using modular components for better organization.
"""

import argparse
import os
import sys
import asyncio
import dotenv

# Add the current directory to the path so we can import the package
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Load environment variables from .env.local
dotenv.load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env.local'))

# Print environment variables for debugging
print(f"AZURE_OPENAI_API_KEY: {'set' if os.getenv('AZURE_OPENAI_API_KEY') else 'not set'}")
print(f"AZURE_OPENAI_ENDPOINT: {os.getenv('AZURE_OPENAI_ENDPOINT')}")
print(f"AZURE_OPENAI_API_VERSION: {os.getenv('AZURE_OPENAI_API_VERSION')}")


# Import the summarizer from the modular package
from transcript_summarizer.summarizer import summarize_transcript, summarize_transcript_async
from transcript_summarizer.utils.text_processing import generate_basic_summary
from transcript_summarizer.fast_summarizer import generate_fast_summary, generate_fast_summary_async


def main():
    """Main entry point for the script"""
    parser = argparse.ArgumentParser(description="Summarize video transcript using Agno agents")
    parser.add_argument("transcript_file", help="Path to the transcript file")
    parser.add_argument("video_title", help="Title of the video")
    parser.add_argument("--use-async", action="store_true", help="Use async execution for better performance")
    parser.add_argument("--fast", action="store_true", help="Use fast summarization (default)")
    parser.add_argument("--detailed", action="store_true", help="Use detailed summarization with chunking")
    
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
    
    print(f"Processing transcript for video: {args.video_title}")
    print(f"Transcript length: {len(transcript_text)} characters")
    
    # Choose summarization method
    if args.detailed:
        print("Using detailed summarization with chunking...")
        if args.use_async:
            summary = asyncio.run(summarize_transcript_async(transcript_text, args.video_title, debug_output=False))
        else:
            summary = summarize_transcript(transcript_text, args.video_title, debug_output=False)
    else:
        # Default to fast summarization
        print("Using fast summarization for quick, concise results...")
        if args.use_async:
            summary = generate_fast_summary_async(transcript_text, args.video_title, debug_output=False)
        else:
            summary = generate_fast_summary(transcript_text, args.video_title, debug_output=False)
    
    # Print the summary
    print("\n" + "="*50)
    print("AI SUMMARY")
    print("="*50)
    print(summary)
    print("="*50)


if __name__ == "__main__":
    main()