# Transcript Summarizer

A modular Python package for summarizing video transcripts using Agno agents with Azure OpenAI integration.

## Overview

The Transcript Summarizer package provides tools for generating comprehensive summaries of video transcripts. It includes:

- Genre detection to customize summaries based on content type
- Transcript correction to fix errors before summarization
- Chunking large transcripts with memory-safe processing
- Asynchronous processing for better performance
- Fallback mechanisms for reliable operation

## Structure

```
transcript_summarizer/
├── agents/                  # Agent definitions
│   ├── __init__.py
│   └── agent_definitions.py
├── templates/               # Template files
│   ├── anti_hallucination_instructions.txt
│   ├── chunk_summary_prompt.txt
│   ├── comprehensive_summary_prompt.txt
│   ├── correction_prompt.txt
│   ├── genre_detection_prompt.txt
│   ├── knowledge_base_instructions.txt
│   └── summary_templates.yaml
├── utils/                   # Utility functions
│   ├── __init__.py
│   ├── template_loader.py
│   └── text_processing.py
├── __init__.py              # Package initialization
├── README.md                # Documentation
└── summarizer.py            # Core summarization logic
```

## Usage

```python
# Async usage
import asyncio
from transcript_summarizer.summarizer import summarize_transcript_async

async def main():
    transcript = "Your transcript text here..."
    video_title = "Your Video Title"
    
    # With debug output (default)
    summary = await summarize_transcript_async(transcript, video_title, debug_output=True)
    
    # Without debug output (clean output)
    summary = await summarize_transcript_async(transcript, video_title, debug_output=False)
    print(summary)

asyncio.run(main())

# Synchronous usage
from transcript_summarizer.summarizer import summarize_transcript

transcript = "Your transcript text here..."
video_title = "Your Video Title"

# With debug output (default)
summary = summarize_transcript(transcript, video_title, debug_output=True)

# Without debug output (clean output)
summary = summarize_transcript(transcript, video_title, debug_output=False)
print(summary)

# Direct class usage
from transcript_summarizer.summarizer import TranscriptSummarizer

summarizer = TranscriptSummarizer(debug_output=False)  # Disable debug output
summary = await summarizer.summarize_async(transcript, video_title)
```

## Command Line Usage

```bash
python summarize_transcript.py path/to/transcript.txt "Video Title" --use-async
```

## Features

- **Genre-specific summarization**: Detects video genre and tailors summaries accordingly
- **Memory-safe processing**: Handles large transcripts with adaptive chunking
- **Asynchronous support**: Better performance with async execution
- **Fallback mechanisms**: Graceful degradation if errors occur
- **Modular architecture**: Easy to maintain and extend
- **Debug output control**: Option to disable verbose debugging information

## Debug Output Control

The summarizer includes extensive debugging information by default, which can be useful for development but may clutter the output in production. You can disable debug output by setting `debug_output=False`:

```python
# Disable debug output for clean summaries
summary = await summarize_transcript_async(transcript, video_title, debug_output=False)
```

When debug output is disabled, the summary will contain only the final AI-generated content without memory usage, processing status, or chunk information.

## Requirements

- Python 3.7+
- Agno agent library
- Azure OpenAI API credentials

## Installation

Install dependencies using `uv`:

```bash
uv add agno azure-identity azure-ai-openai
```

### Environment Variables

Set the following environment variables with your Azure OpenAI credentials:

```bash
# For bash/zsh
export AZURE_OPENAI_API_KEY=your_api_key_here
export AZURE_OPENAI_API_VERSION=2024-12-01-preview
export AZURE_OPENAI_ENDPOINT=your_endpoint_url_here
```

## Team-Based Architecture

This package uses Agno's team architecture to process transcript chunks in parallel:

1. Transcript is split into chunks with overlap
2. A team of LLM agents processes these chunks simultaneously
3. Results are combined into a comprehensive summary
4. Genre-specific formatting is applied for optimal readability

This parallelization significantly improves processing speed compared to sequential processing.