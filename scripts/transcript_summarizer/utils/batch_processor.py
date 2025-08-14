"""
Batch processing utility for transcript correction and summarization

This module provides functions for processing transcripts in batches,
which improves performance for large transcripts.
"""

import asyncio
from typing import List, Dict, Any, Callable, Optional
from pydantic import BaseModel, Field


class TranscriptChunk(BaseModel):
    """Schema for transcript chunk correction"""
    orig_transcript: str = Field(description="The original transcript of the chunk.")
    fixed_transcript: str = Field(description="The fixed transcript of the chunk.")


def split_text_into_chunks(text: str, chunk_size: int = 2500, overlap: int = 250) -> List[str]:
    """Split text into overlapping chunks
    
    Args:
        text (str): Input text to be split
        chunk_size (int): Size of each chunk in characters
        overlap (int): Number of characters to overlap between chunks
        
    Returns:
        list: List of text chunks
    """
    chunks = []
    start = 0
    
    while start < len(text):
        end = start + chunk_size
        
        # If this is not the last chunk, try to break at a word boundary
        if end < len(text):
            # Look for the last space within the last 100 characters of the chunk
            last_space = text.rfind(' ', start, end)
            if last_space > start + chunk_size - 100:
                end = last_space
        
        chunk = text[start:end]
        chunks.append(chunk)
        
        # Move start position for next chunk, accounting for overlap
        start = end - overlap
        
        # If we're at the end, break
        if start >= len(text):
            break
    
    return chunks


async def process_chunk(chunk: str, processor_fn: Callable, chunk_idx: int, total_chunks: int, 
                       **kwargs) -> Dict[str, Any]:
    """Process a single chunk using the provided function
    
    Args:
        chunk (str): Text chunk to process
        processor_fn (callable): Function to process the chunk
        chunk_idx (int): Index of the current chunk
        total_chunks (int): Total number of chunks
        **kwargs: Additional arguments to pass to processor_fn
        
    Returns:
        dict: Processed chunk result with metadata
    """
    try:
        result = await processor_fn(chunk, chunk_idx, total_chunks, **kwargs)
        return {
            'result': result,
            'chunk_idx': chunk_idx,
            'success': True
        }
    except Exception as e:
        print(f"Error processing chunk {chunk_idx}: {e}")
        return {
            'result': chunk,  # Return original chunk on error
            'chunk_idx': chunk_idx,
            'success': False,
            'error': str(e)
        }


async def process_in_batches(text: str, processor_fn: Callable, 
                           chunk_size: int = 2500, overlap: int = 250,
                           debug_output: bool = True, **kwargs) -> List[Dict[str, Any]]:
    """Process text in overlapping batches with parallel execution
    
    Args:
        text (str): Full text to process
        processor_fn (callable): Function to process each chunk
        chunk_size (int): Size of each chunk in characters
        overlap (int): Number of characters to overlap between chunks
        debug_output (bool): Whether to print debugging information
        **kwargs: Additional arguments to pass to processor_fn
        
    Returns:
        list: List of processed chunk results with metadata
    """
    # Split text into chunks
    chunks = split_text_into_chunks(text, chunk_size, overlap)
    if debug_output:
        print(f"Split into {len(chunks)} chunks with {overlap} character overlap")
    
    # Process chunks in parallel
    tasks = []
    for i, chunk in enumerate(chunks):
        # Use asyncio.to_thread for CPU-bound functions, direct awaiting for async functions
        if asyncio.iscoroutinefunction(processor_fn):
            task = asyncio.create_task(processor_fn(chunk, i + 1, len(chunks), **kwargs))
        else:
            task = asyncio.create_task(asyncio.to_thread(
                processor_fn, chunk, i + 1, len(chunks), **kwargs))
        tasks.append(task)
    
    # Wait for all chunks to be processed
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Process results
    processed_results = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            if debug_output:
                print(f"Error in chunk processing: {result}")
            processed_results.append({
                'result': chunks[i],  # Return original chunk on error
                'chunk_idx': i + 1,
                'success': False,
                'error': str(result)
            })
        else:
            processed_results.append(result)
    
    return processed_results


def combine_chunk_results(results: List[Dict[str, Any]], 
                        combine_fn: Optional[Callable] = None) -> Any:
    """Combine chunk results into a single result
    
    Args:
        results (list): List of chunk processing results
        combine_fn (callable, optional): Function to combine results
            If None, results will be joined with spaces
        
    Returns:
        Any: Combined result
    """
    if not results:
        return None
    
    # Sort results by chunk index
    sorted_results = sorted(results, key=lambda x: x['chunk_idx'])
    
    # Extract results
    processed_chunks = [r['result'] for r in sorted_results if r['success']]
    
    # Use custom combine function if provided
    if combine_fn:
        return combine_fn(processed_chunks)
    
    # Default combining by joining with space
    return ' '.join(processed_chunks)