#!/usr/bin/env python3
"""
Incremental Transcript Summarization Script

This script generates summary variants incrementally, starting with priority variants
and then generating the rest in batches. It reports progress back to the Node.js process
so users can see available variants immediately.
"""

import argparse
import os
import sys
import json
import asyncio
import dotenv

# Add the current directory to the path so we can import the package
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Load environment variables from .env.local
dotenv.load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env.local'))

# Import the comprehensive summarizer
from transcript_summarizer.comprehensive_summarizer import generate_summaries_incrementally, get_summary_metadata

def progress_callback(difficulty, length, summary, status):
    """Callback function to report progress back to Node.js"""
    progress_data = {
        'difficulty': difficulty,
        'length': length,
        'status': status,
        'summary': summary if status == 'completed' else None
    }
    
    # Print progress in a format that Node.js can parse
    print(f"PROGRESS:{json.dumps(progress_data)}", flush=True)

async def main():
    """Main entry point for the script"""
    parser = argparse.ArgumentParser(description="Generate incremental summary variants for video transcript")
    parser.add_argument("transcript_file", help="Path to the transcript file")
    parser.add_argument("video_title", help="Title of the video")
    parser.add_argument("video_id", help="YouTube video ID for progress tracking")
    parser.add_argument("--output-file", help="Output file for JSON results (optional)")
    
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
    
    print(f"Processing incremental summaries for video: {args.video_title}")
    print(f"Video ID: {args.video_id}")
    print(f"Transcript length: {len(transcript_text)} characters")
    
    # Get metadata about available options
    metadata = get_summary_metadata()
    print(f"Generating {metadata['total_variants']} summary variants:")
    print(f"- Difficulty levels: {len(metadata['difficulty_levels'])}")
    print(f"- Length options: {len(metadata['length_options'])}")
    
    # Define priority variants to generate first
    priority_variants = [
        ('intermediate', 'normal'),  # Default variant
        ('beginner', 'normal'),      # Easy to understand
        ('intermediate', 'short'),   # Quick read
        ('intermediate', 'long'),    # More detail
        ('novice', 'normal'),        # Clear explanations
        ('advanced', 'normal'),      # Technical depth
    ]
    
    print(f"\nPriority variants (generating first):")
    for difficulty, length in priority_variants:
        print(f"- {difficulty.title()} + {length.replace('_', ' ').title()}")
    
    # Generate summaries incrementally
    print("\nStarting incremental summary generation...")
    all_summaries = await generate_summaries_incrementally(
        transcript_text, 
        args.video_title, 
        progress_callback=progress_callback,
        priority_variants=priority_variants
    )
    
    # Prepare the output structure
    output_data = {
        'video_title': args.video_title,
        'video_id': args.video_id,
        'transcript_length': len(transcript_text),
        'metadata': metadata,
        'summaries': all_summaries,
        'generated_at': __import__('datetime').datetime.now().isoformat()
    }
    
    # Print summary statistics
    print("\n" + "="*60)
    print("INCREMENTAL SUMMARY GENERATION COMPLETE")
    print("="*60)
    
    total_generated = 0
    for difficulty, lengths in all_summaries.items():
        for length, summary in lengths.items():
            if summary and not summary.startswith("Summary generation failed"):
                total_generated += 1
                word_count = len(summary.split())
                print(f"✓ {difficulty.title()} + {length.replace('_', ' ').title()}: {word_count} words")
    
    print(f"\nSuccessfully generated {total_generated}/{metadata['total_variants']} summary variants")
    
    # Save to output file if specified
    if args.output_file:
        try:
            with open(args.output_file, 'w', encoding='utf-8') as f:
                json.dump(output_data, f, indent=2, ensure_ascii=False)
            print(f"\nResults saved to: {args.output_file}")
        except Exception as e:
            print(f"Error saving to output file: {e}")
    
    # Print final JSON result - this must be the last output for Node.js to parse correctly
    print("\n" + "="*60)
    print("FINAL_RESULT_START")
    print("="*60)
    print(json.dumps(output_data, indent=2, ensure_ascii=False))
    print("="*60)
    print("FINAL_RESULT_END")
    print("="*60)

if __name__ == "__main__":
    asyncio.run(main())
