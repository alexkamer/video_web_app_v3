#!/usr/bin/env python3
"""
Test script for the summary prettifier functionality
"""

import asyncio
import sys
import os
import dotenv

# Add the current directory to the path so we can import the package
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Load environment variables from .env.local
dotenv.load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env.local'))

from transcript_summarizer.summarizer import TranscriptSummarizer

async def test_prettifier():
    """Test the summary prettifier functionality"""
    
    # Sample summary text to prettify
    sample_summary = """
    This video discusses machine learning algorithms and their applications in data science. The presenter explains how neural networks work and demonstrates practical examples using Python. Key concepts include supervised learning, unsupervised learning, and deep learning techniques. The video also covers important topics like data preprocessing, model evaluation, and deployment strategies.
    
    The main points covered are:
    - Introduction to machine learning
    - Neural network architecture
    - Training and optimization
    - Real-world applications
    
    The presenter emphasizes the importance of understanding the fundamentals before diving into complex implementations.
    """
    
    print("Testing Summary Prettifier")
    print("=" * 50)
    print("Original Summary:")
    print(sample_summary)
    print("\n" + "=" * 50)
    
    try:
        # Create summarizer instance
        summarizer = TranscriptSummarizer(debug_output=True)
        
        # Test prettification
        print("Prettifying summary...")
        prettified = await summarizer.prettify_summary_async(sample_summary)
        
        print("\nPrettified Summary:")
        print(prettified)
        print("\n" + "=" * 50)
        
        print("✅ Prettifier test completed successfully!")
        
    except Exception as e:
        print(f"❌ Error testing prettifier: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_prettifier())
