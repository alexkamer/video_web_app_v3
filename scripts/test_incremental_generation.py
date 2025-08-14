#!/usr/bin/env python3
"""
Test script for incremental summary generation

This script tests the incremental generation functionality to ensure it works correctly.
"""

import asyncio
import sys
import os

# Add the current directory to the path so we can import the package
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from transcript_summarizer.comprehensive_summarizer import generate_summaries_incrementally, get_summary_metadata

async def test_incremental_generation():
    """Test the incremental generation functionality"""
    
    # Sample transcript text for testing
    sample_transcript = """
    This is a sample video transcript for testing the incremental summary generation.
    The video discusses various topics including technology, science, and innovation.
    We will explore how artificial intelligence is transforming different industries.
    Machine learning algorithms are becoming more sophisticated and accessible.
    Companies are adopting AI solutions to improve efficiency and productivity.
    The future of work will be heavily influenced by automation and AI technologies.
    """
    
    video_title = "Test Video: AI and the Future of Technology"
    video_id = "test_video_123"
    
    print("Testing incremental summary generation...")
    print(f"Video Title: {video_title}")
    print(f"Video ID: {video_id}")
    print(f"Transcript length: {len(sample_transcript)} characters")
    
    # Track progress
    progress_count = 0
    
    def progress_callback(difficulty, length, summary, status):
        nonlocal progress_count
        progress_count += 1
        print(f"Progress {progress_count}: {difficulty}/{length} - {status}")
        if summary:
            word_count = len(summary.split())
            print(f"  Summary length: {word_count} words")
    
    # Generate summaries incrementally
    print("\nStarting incremental generation...")
    all_summaries = await generate_summaries_incrementally(
        sample_transcript, 
        video_title, 
        progress_callback=progress_callback
    )
    
    # Print results
    print("\n" + "="*60)
    print("INCREMENTAL GENERATION TEST RESULTS")
    print("="*60)
    
    total_generated = 0
    for difficulty, lengths in all_summaries.items():
        for length, summary in lengths.items():
            if summary and not summary.startswith("Summary generation failed"):
                total_generated += 1
                word_count = len(summary.split())
                print(f"✓ {difficulty.title()} + {length.replace('_', ' ').title()}: {word_count} words")
    
    print(f"\nSuccessfully generated {total_generated} summary variants")
    
    # Test specific variants
    print("\nTesting specific variant retrieval:")
    if 'intermediate' in all_summaries and 'normal' in all_summaries['intermediate']:
        intermediate_normal = all_summaries['intermediate']['normal']
        if not intermediate_normal.startswith("Summary generation failed"):
            print("✓ Intermediate + Normal variant available")
            print(f"  Preview: {intermediate_normal[:100]}...")
        else:
            print("✗ Intermediate + Normal variant failed")
    else:
        print("✗ Intermediate + Normal variant not found")
    
    if 'beginner' in all_summaries and 'short' in all_summaries['beginner']:
        beginner_short = all_summaries['beginner']['short']
        if not beginner_short.startswith("Summary generation failed"):
            print("✓ Beginner + Short variant available")
            print(f"  Preview: {beginner_short[:100]}...")
        else:
            print("✗ Beginner + Short variant failed")
    else:
        print("✗ Beginner + Short variant not found")
    
    print("\nTest completed successfully!")

if __name__ == "__main__":
    asyncio.run(test_incremental_generation())
