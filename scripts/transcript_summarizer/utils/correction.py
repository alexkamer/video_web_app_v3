"""
Transcript correction utility functions

This module provides specialized functions for correcting transcripts
using batched processing for improved performance.
"""

import asyncio
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field

from agno.agent import Agent
from .batch_processor import split_text_into_chunks, process_in_batches


class TranscriptChunk(BaseModel):
    """Schema for transcript chunk correction"""
    orig_transcript: str = Field(description="The original transcript of the chunk.")
    fixed_transcript: str = Field(description="The fixed transcript of the chunk.")


async def fix_transcript_chunk(chunk: str, chunk_idx: int, total_chunks: int, 
                             llm, video_title: str = "") -> Dict[str, str]:
    """Fix a single chunk of transcript text
    
    Args:
        chunk (str): Text chunk to correct
        chunk_idx (int): Index of current chunk
        total_chunks (int): Total number of chunks
        llm: LLM instance to use for correction
        video_title (str): Video title for context
        
    Returns:
        dict: Dictionary with original and fixed transcript
    """
    try:
        # Create a temporary agent for this chunk
        context = f" for video '{video_title}'" if video_title else ""
        
        temp_agent = Agent(
            model=llm,
            name=f"Chunk Correction Agent {chunk_idx}",
            system_message=f"""**Role**: You are a correction agent processing chunk {chunk_idx} of {total_chunks} for the video titled "{video_title}".

            **Objective**: Correct errors in the provided transcript chunk while preserving the original meaning and structure.

            **Instructions**:

            *   You will be given a portion of a YouTube transcript that may contain errors from automatic speech recognition.
            *   Your task is to fix mistakes without introducing new ones.
            *   Respond with a dictionary containing two keys: `orig_transcript` and `fixed_transcript`.
            *   **Crucially**, return the transcript in the same language as the original.
            """,
            response_model=TranscriptChunk,
        )
        
        response = await temp_agent.arun(f'Fix the following transcript chunk: {chunk}')
        return {
            'orig_transcript': response.content.orig_transcript,
            'fixed_transcript': response.content.fixed_transcript,
        }
    except Exception as e:
        print(f"Error processing chunk {chunk_idx}: {e}")
        return {
            'orig_transcript': chunk,
            'fixed_transcript': chunk,
        }


async def correct_transcript_batched(transcript_text: str, llm, video_title: str = "", 
                                   chunk_size: int = 2500, overlap: int = 250, debug_output: bool = True) -> str:
    """Correct transcript text using batched processing
    
    Args:
        transcript_text (str): Raw transcript text
        llm: LLM instance to use for correction
        video_title (str): Title of the video
        chunk_size (int): Size of each chunk
        overlap (int): Overlap between chunks
        debug_output (bool): Whether to print debugging information
        
    Returns:
        str: Corrected transcript text
    """
    if debug_output:
        print(f"Batch correcting transcript of {len(transcript_text)} characters...")
    
    async def process_chunk_wrapper(chunk, chunk_idx, total_chunks):
        return await fix_transcript_chunk(chunk, chunk_idx, total_chunks, llm, video_title)
    
    # Process chunks in parallel
    results = await process_in_batches(
        transcript_text, 
        process_chunk_wrapper,
        chunk_size=chunk_size, 
        overlap=overlap,
        debug_output=debug_output
    )
    
    # Combine results
    fixed_parts = []
    
    # Sort by chunk index and extract fixed transcripts
    sorted_results = sorted(results, key=lambda x: x['chunk_idx'])
    for result in sorted_results:
        if result['success'] and 'result' in result:
            chunk_result = result['result']
            if 'fixed_transcript' in chunk_result:
                fixed_parts.append(chunk_result['fixed_transcript'])
            else:
                # Fallback if structure is unexpected
                fixed_parts.append(str(chunk_result))
    
    # Combine the parts
    combined_fixed = ' '.join(fixed_parts)
    
    return combined_fixed