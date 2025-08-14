#!/usr/bin/env python3
"""
Generate concise previews for video chapters using Azure OpenAI.
"""

import sys
import os
import argparse
import json
from pathlib import Path

# Add the project root to the Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

try:
    from openai import AzureOpenAI
except ImportError as e:
    print(f"Error: Required Azure OpenAI SDK not found: {e}")
    print("Please install with: uv add openai azure-identity")
    sys.exit(1)

def load_environment():
    """Load environment variables."""
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass  # Silently use system environment
    
    # Check required environment variables
    required_vars = ['AZURE_OPENAI_API_KEY', 'AZURE_OPENAI_ENDPOINT']
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    
    if missing_vars:
        print(f"Error: Missing required environment variables: {missing_vars}")
        sys.exit(1)

def generate_chapter_preview(transcript_file, chapter_title):
    """Generate a concise preview for a video chapter."""
    
    # Load environment
    load_environment()
    
    # Read transcript
    try:
        with open(transcript_file, 'r', encoding='utf-8') as f:
            transcript = f.read()
    except Exception as e:
        print(f"Error reading transcript file: {e}")
        sys.exit(1)
    
    # Initialize Azure OpenAI client
    api_key = os.getenv('AZURE_OPENAI_API_KEY')
    endpoint = os.getenv('AZURE_OPENAI_ENDPOINT')
    api_version = os.getenv('AZURE_OPENAI_API_VERSION', '2024-12-01-preview')
    deployment = os.getenv('AZURE_OPENAI_DEPLOYMENT', 'gpt-4-1')
    
    if not api_key or not endpoint:
        print("Error: Azure OpenAI credentials not configured")
        sys.exit(1)
    
    try:
        client = AzureOpenAI(
            api_key=api_key,
            api_version=api_version,
            azure_endpoint=endpoint
        )
    except Exception as e:
        print(f"Error initializing Azure OpenAI client: {e}")
        sys.exit(1)
    
    # Create varied prompts to avoid repetitive formats
    prompt_styles = [
        {
            "style": "direct_statement",
            "system": """You write direct, punchy previews that get straight to the point. Use active voice and concrete details. Avoid questions or generic phrases."""
        },
        {
            "style": "benefit_focused", 
            "system": """You write previews that focus on the practical benefits and outcomes. What will this help users accomplish? Be specific about real-world applications."""
        },
        {
            "style": "problem_solution",
            "system": """You write previews that identify a common problem and show how this chapter solves it. Use contrast and specific pain points."""
        },
        {
            "style": "comparison",
            "system": """You write previews that compare this to alternatives or show what makes it special. Use 'instead of' or 'unlike' structures."""
        },
        {
            "style": "action_oriented",
            "system": """You write previews that focus on what users can do with this. Use action verbs and specific capabilities. Start with what's possible."""
        },
        {
            "style": "insight_focused",
            "system": """You write previews that share an interesting insight or perspective about the topic. What's the key takeaway or surprising fact?"""
        }
    ]
    
    # Select a random style for variety
    import random
    selected_style = random.choice(prompt_styles)
    
    system_prompt = f"""You are a creative assistant that writes unique previews for video chapters. {selected_style['system']}

Your task is to create a brief preview (2-3 sentences) that:
- Gives viewers a quick understanding of the chapter content
- Uses the specific style assigned to you
- Avoids generic phrases like "Learn how to", "Discover", "This chapter covers"
- Is natural and conversational
- Focuses on what makes this chapter valuable or interesting

Return only the preview text, no additional formatting or explanations."""

    user_prompt = f"""Write a preview for this video chapter using your assigned style:

Chapter Title: {chapter_title}

Transcript Content:
{transcript}

Create a brief preview (2-3 sentences) that gives viewers a quick understanding of what's in this chapter."""

    try:
        response = client.chat.completions.create(
            model=deployment,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            max_tokens=150
        )
        
        preview = response.choices[0].message.content.strip()
        
        # Remove any duplicate text (sometimes AI repeats content)
        # First, check for exact duplicate content in the entire response
        words = preview.split()
        if len(words) > 10:  # Only process if we have enough words
            # Find the midpoint and check if the second half is a duplicate of the first
            mid_point = len(words) // 2
            first_half = ' '.join(words[:mid_point])
            second_half = ' '.join(words[mid_point:])
            
            # If the second half is very similar to the first half, use only the first half
            if first_half in second_half or second_half in first_half:
                preview = first_half
        
        # Also check for sentence-level duplicates
        sentences = preview.split('. ')
        unique_sentences = []
        for sentence in sentences:
            sentence = sentence.strip()
            if sentence and sentence not in unique_sentences:
                unique_sentences.append(sentence)
        preview = '. '.join(unique_sentences)
        
        # Also check for exact duplicate paragraphs
        paragraphs = preview.split('\n\n')
        unique_paragraphs = []
        for paragraph in paragraphs:
            paragraph = paragraph.strip()
            if paragraph and paragraph not in unique_paragraphs:
                unique_paragraphs.append(paragraph)
        preview = '\n\n'.join(unique_paragraphs)
        
        return preview
        
    except Exception as e:
        print(f"Error generating preview: {e}")
        # Return a fallback preview
        return f"This chapter covers {chapter_title.lower()}. Watch to learn more about this topic."

def main():
    parser = argparse.ArgumentParser(description='Generate chapter preview using Azure OpenAI')
    parser.add_argument('transcript_file', help='Path to the transcript file')
    parser.add_argument('chapter_title', help='Title of the chapter')
    
    args = parser.parse_args()
    
    if not os.path.exists(args.transcript_file):
        print(f"Error: Transcript file not found: {args.transcript_file}")
        sys.exit(1)
    
    try:
        preview = generate_chapter_preview(args.transcript_file, args.chapter_title)
        print(preview)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
