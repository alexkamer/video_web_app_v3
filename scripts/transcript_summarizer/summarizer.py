"""
Core summarization functionality for transcript summarization

This module provides the main functions for summarizing transcripts
using Agno agents and modular components.
"""

import asyncio
import os
import gc
import time
import json
from typing import Dict, List, Optional, Union

# Import agent definitions
from .agents.agent_definitions import create_agents

# Import utility functions
from .utils.text_processing import create_overlapping_chunks, generate_basic_summary, extract_json_from_text
from .utils.template_loader import load_prompt_template, load_summary_templates, get_summary_template
from .utils.correction import correct_transcript_batched
from .utils.batch_processor import split_text_into_chunks, process_in_batches

class TranscriptSummarizer:
    """Class for summarizing video transcripts"""
    
    def __init__(self, debug_output=True):
        """Initialize the summarizer with agents and templates
        
        Args:
            debug_output (bool): Whether to print debugging information
        """
        # Create agents on initialization
        self.agents = create_agents()
        
        # Load templates
        self.templates = load_summary_templates()
        
        # Load prompt templates
        self.correction_prompt = load_prompt_template("correction_prompt")
        self.chunk_summary_prompt = load_prompt_template("chunk_summary_prompt")
        self.comprehensive_summary_prompt = load_prompt_template("comprehensive_summary_prompt")
        self.genre_detection_prompt = load_prompt_template("genre_detection_prompt")
        self.knowledge_base_instructions = load_prompt_template("knowledge_base_instructions")
        self.anti_hallucination_instructions = load_prompt_template("anti_hallucination_instructions")
        
        # Debug output control
        self.debug_output = debug_output
        
    def _create_fallback_chunk_summary(self, chunk_text: str, chunk_num: int) -> str:
        """Create a fallback summary for a chunk when LLM processing fails
        
        Args:
            chunk_text (str): The chunk text to summarize
            chunk_num (int): The chunk number (1-based)
            
        Returns:
            str: A simple extractive summary of the chunk
        """
        try:
            # Extract first few sentences (up to 150 chars) as a preview
            preview_length = min(150, len(chunk_text))
            preview = chunk_text[:preview_length].strip()
            if len(chunk_text) > preview_length:
                preview += "..."
                
            # Get word count
            word_count = len(chunk_text.split())
                
            # Create a simple fallback summary
            fallback = f"**Chunk {chunk_num} - Fallback Summary**\n\n"
            fallback += f"This section contains approximately {word_count} words.\n\n"
            fallback += f"Preview: {preview}\n\n"
            fallback += "[Full AI summary unavailable - using basic extractive summary instead]"
            
            return fallback
            
        except Exception as e:
            # Ultimate fallback if even the simple summary fails
            return f"[Summary for chunk {chunk_num} unavailable due to processing error]"
    
    async def correct_transcript_async(self, transcript_text: str, video_title: str) -> str:
        """Correct transcript errors in the background before summarization (async version)
        
        Args:
            transcript_text (str): Raw transcript text
            video_title (str): Title of the video
            
        Returns:
            str: Corrected transcript text
        """
        if not transcript_text:
            return transcript_text
        
        try:
            if self.debug_output:
                print("Correcting transcript errors in background...")
            
            # Check if transcript is long enough for batch processing
            # Use batch processing for long transcripts (over 3000 chars)
            if len(transcript_text) > 3000:
                if self.debug_output:
                    print(f"Using batched processing for transcript ({len(transcript_text)} characters)")
                # Use the batched correction with LLM from agents
                corrected_text = await correct_transcript_batched(
                    transcript_text, 
                    self.agents["llm"], 
                    video_title,
                    chunk_size=2500,
                    overlap=250,
                    debug_output=self.debug_output
                )
            else:
                if self.debug_output:
                    print(f"Using single-pass processing for short transcript ({len(transcript_text)} characters)")
                # Format the correction prompt with video title and transcript
                prompt = self.correction_prompt.format(
                    video_title=video_title,
                    transcript_text=transcript_text
                )
                
                # Get corrected transcript using async execution
                response = await self.agents["correction_agent"].arun(prompt)
                corrected_text = response.content
            
            # Compare word counts to see if significant changes were made
            original_words = len(transcript_text.split())
            corrected_words = len(corrected_text.split())
            
            if abs(original_words - corrected_words) > 10:
                if self.debug_output:
                    print(f"Transcript corrected: {original_words} → {corrected_words} words")
            else:
                if self.debug_output:
                    print("Transcript correction complete (minor changes)")
            
            return corrected_text
            
        except Exception as e:
            if self.debug_output:
                print(f"Error correcting transcript: {e}")
            # Return original if correction fails
            return transcript_text
    
    async def _process_chunks_in_parallel(self, chunks, video_title, monitor_memory, process):
        """Process transcript chunks in parallel for faster execution
        
        Args:
            chunks (list): List of text chunks to process
            video_title (str): Title of the video
            monitor_memory (bool): Whether to monitor memory usage
            process: Process object for memory monitoring
            
        Returns:
            list: List of chunk summaries
        """
        # Check memory before team processing
        if monitor_memory:
            current_memory = process.memory_info().rss / 1024 / 1024
            if self.debug_output:
                print(f"Memory before parallel processing: {current_memory:.2f} MB")
        
        # Function to process a single chunk with retries
        async def process_single_chunk(chunk, chunk_idx):
            max_retries = 2
            retry_count = 0
            
            while retry_count <= max_retries:
                try:
                    chunk_summary = await self.summarize_chunk_async(
                        chunk, video_title, chunk_idx, len(chunks))
                    if self.debug_output:
                        print(f"✓ Successfully processed chunk {chunk_idx+1}")
                    return chunk_summary
                except Exception as e:
                    retry_count += 1
                    if retry_count <= max_retries:
                        if self.debug_output:
                            print(f"Error in chunk {chunk_idx+1}, will retry ({retry_count}/{max_retries}): {e}")
                        await asyncio.sleep(1)  # Wait before retrying
                    else:
                        if self.debug_output:
                            print(f"❌ Failed all retries for chunk {chunk_idx+1}: {e}")
                        # Create fallback summary if all retries fail
                        return self._create_fallback_chunk_summary(chunk, chunk_idx+1)
        
        # Create tasks for processing chunks
        start_time = time.time()
        tasks = []
        
        for i, chunk in enumerate(chunks):
            # Add delay between task creations to prevent rate limiting
            if i > 0:
                await asyncio.sleep(0.5)  # Half-second delay between task starts
            
            # Create and start the task
            task = asyncio.create_task(process_single_chunk(chunk, i))
            tasks.append(task)
        
        # Wait for all tasks to complete
        chunk_summaries = await asyncio.gather(*tasks)
        
        # Calculate and print timing information
        processing_time = time.time() - start_time
        chunks_per_second = len(chunks) / processing_time if processing_time > 0 else 0
        if self.debug_output:
            print(f"Processed {len(chunks)} chunks in parallel in {processing_time:.2f}s ({chunks_per_second:.2f} chunks/sec)")
        
        # Monitor memory after processing all chunks
        if monitor_memory:
            current_memory = process.memory_info().rss / 1024 / 1024
            if self.debug_output:
                print(f"Memory after parallel processing: {current_memory:.2f} MB")
        
        return chunk_summaries
            
    async def summarize_chunk_async(self, chunk_text: str, video_title: str, 
                                  chunk_idx: int, total_chunks: int) -> str:
        """Summarize a single chunk of the transcript (async version)
        
        Args:
            chunk_text (str): Text of the current chunk
            video_title (str): Title of the video
            chunk_idx (int): Index of the current chunk (0-based)
            total_chunks (int): Total number of chunks
            
        Returns:
            str: Summary of the chunk
        """
        try:
            # Calculate 1-based chunk number for display
            chunk_num = chunk_idx + 1
            
            # Format the chunk summary prompt
            prompt = self.chunk_summary_prompt.format(
                video_title=video_title,
                chunk_text=chunk_text,
                chunk_num=chunk_num,
                total_chunks=total_chunks
            )
            
            # Use individual agent (fallback for single chunks)
            response = await self.agents["chunk_agent"].arun(prompt)
            return response.content
            
        except Exception as e:
            if self.debug_output:
                print(f"Error summarizing chunk {chunk_idx + 1}: {e}")
            # Provide basic summary for this chunk
            return f"[Chunk {chunk_idx + 1} summary unavailable due to error]"
    
    async def detect_video_genre_async(self, transcript_text: str, video_title: str) -> Dict[str, str]:
        """Detect the genre and content type of the video based on transcript and title
        
        Args:
            transcript_text (str): Transcript text to analyze
            video_title (str): Title of the video
            
        Returns:
            dict: Dictionary with genre and content_type keys
        """
        if not transcript_text:
            return {"genre": "unknown", "content_type": "informational"}
        
        try:
            if self.debug_output:
                print("Detecting video genre and content type...")
            
            # Use a smaller sample of the transcript for genre detection
            sample_length = min(len(transcript_text), 4000)
            transcript_sample = transcript_text[:sample_length]
            
            # Format the genre detection prompt
            prompt = self.genre_detection_prompt.format(
                video_title=video_title,
                transcript_sample=transcript_sample
            )
            
            # Get genre classification using async execution
            response = await self.agents["genre_detection_agent"].arun(prompt)
            
            # Extract JSON from the response
            classification = extract_json_from_text(response.content)
            
            # Get template recommendations for additional insights
            from .utils.template_loader import get_template_recommendations
            recommendations = get_template_recommendations(
                transcript_text, 
                video_title, 
                self.templates, 
                top_n=3
            )
            
            # Log genre detection results and recommendations
            if self.debug_output:
                print(f"Detected genre: {classification['genre']}, content type: {classification['content_type']}")
                if recommendations:
                    print(f"Template recommendations based on content analysis:")
                    for template_name, score in recommendations:
                        print(f"  - {template_name} (score: {score})")
            
            return classification
            
        except Exception as e:
            if self.debug_output:
                print(f"Error detecting video genre: {e}")
            # Return default classification
            return {"genre": "educational", "content_type": "informational"}
    
    async def create_comprehensive_summary_async(self, chunk_summaries: List[str], 
                                               video_title: str, transcript_text: str, difficulty: str = "Normal") -> str:
        """Create a comprehensive summary from all chunk summaries (async version)
        
        Args:
            chunk_summaries (list): List of individual chunk summaries
            video_title (str): Title of the video
            transcript_text (str): Full transcript text (for genre detection)
            difficulty (str): The desired vocabulary difficulty of the summary
            
        Returns:
            str: Comprehensive summary
        """
        try:
            # Filter out completely failed chunks and keep valid summaries
            valid_summaries = []
            error_notes = []
            
            for i, summary in enumerate(chunk_summaries):
                # Check if it's an error message
                if summary.startswith("[") and "unavailable due to" in summary:
                    error_notes.append(f"- Chunk {i+1} summary was unavailable")
                else:
                    valid_summaries.append(summary)
            
            # Only proceed if we have at least some valid summaries
            if not valid_summaries:
                raise ValueError("No valid chunk summaries available for comprehensive summary")
                
            # Join all valid summaries with a separator
            combined_text = "\n---BREAK---\n".join(valid_summaries)
            
            # Detect video genre and get appropriate template
            genre_info = await self.detect_video_genre_async(transcript_text, video_title)
            template = get_summary_template(
                genre_info["genre"], 
                genre_info["content_type"], 
                self.templates,
                transcript_text=transcript_text,
                video_title=video_title
            )
            
            # Log template selection
            if self.debug_output:
                print(f"Selected template: {next((k for k, v in self.templates.items() if v == template), 'unknown')}")
            
            # Extract a title topic by removing common words
            title_words = video_title.split()
            title_topic = video_title
            
            # Add special instructions for educational content
            knowledge_base_instructions = ""
            anti_hallucination_instructions = ""
            
            if genre_info["genre"].lower() in ["educational", "tutorial", "course", "technical", "science"] or \
               genre_info["content_type"].lower() in ["informational", "instructional", "analytical"]:
                knowledge_base_instructions = self.knowledge_base_instructions
                anti_hallucination_instructions = self.anti_hallucination_instructions
            
            # Format the comprehensive summary prompt
            structure_items = "\n".join([f"- {section}" for section in template["structure"]])
            
            # Add note about missing chunks if needed
            incomplete_note = ""
            if len(valid_summaries) < len(chunk_summaries):
                incomplete_note = "\n\n**IMPORTANT NOTE**: Some transcript sections could not be processed. Your summary should note that it may be incomplete.\n"
            
            # Get sentiment and tone from genre detection, with fallbacks
            sentiment = genre_info.get("sentiment", "neutral")
            tone = genre_info.get("tone", template["tone"])
            engagement_style = genre_info.get("engagement_style", "informative")
            
            prompt = self.comprehensive_summary_prompt.format(
                genre=genre_info["genre"],
                content_type=genre_info["content_type"],
                sentiment=sentiment,
                tone=tone,
                engagement_style=engagement_style,
                video_title=video_title,
                intro=template["intro"].format(title_topic=title_topic),
                structure=structure_items,
                knowledge_base_instructions=knowledge_base_instructions,
                anti_hallucination_instructions=anti_hallucination_instructions,
                combined_text=combined_text,
                difficulty=difficulty
            ) + incomplete_note
            
            # Use async execution
            response = await self.agents["comprehensive_agent"].arun(prompt)
            
            # Add genre emoji to the beginning of the summary
            formatted_summary = f"{template['emoji']} **{genre_info['genre'].upper()} {genre_info['content_type'].upper()}**\n\n{response.content}"
            
            # Add a note about incomplete processing if needed
            if error_notes:
                formatted_summary += "\n\n---\n\n**Note**: This summary was created with incomplete data. The following sections could not be processed:\n"
                formatted_summary += "\n".join(error_notes)
            
            # Prettify the summary for better visual appeal
            prettified_summary = await self.prettify_summary_async(formatted_summary)
            
            return prettified_summary
            
        except Exception as e:
            if self.debug_output:
                print(f"Error creating comprehensive summary: {e}")
            
            # Try to filter valid summaries for fallback
            valid_fallback_summaries = [
                summary for summary in chunk_summaries 
                if not (summary.startswith("[") and "unavailable due to" in summary)
            ]
            
            # Fallback: create a basic combined summary
            if valid_fallback_summaries:
                combined_text = "\n\n".join([
                    f"🎬 **Part {i+1} of {len(chunk_summaries)}**\n\n{summary}" 
                    for i, summary in enumerate(valid_fallback_summaries)
                ])
                return f"🎬 **{video_title}**\n\n**Emergency Fallback Summary**\n\nThe AI was unable to create a unified summary, so here are the individual section summaries:\n\n{combined_text}"
            else:
                # Ultimate fallback if no valid summaries at all
                return generate_basic_summary(transcript_text[:10000], video_title)
    
    async def prettify_summary_async(self, summary_text: str) -> str:
        """Prettify a summary to make it more visually appealing and readable (async version)
        
        Args:
            summary_text (str): The summary text to prettify
            
        Returns:
            str: The prettified summary with enhanced formatting
        """
        try:
            # Load the prettifier prompt template
            prettifier_prompt = load_prompt_template("summary_prettifier_prompt")
            
            # Format the prompt with the summary text
            prompt = prettifier_prompt.format(summary_text=summary_text)
            
            # Use the prettifier agent to enhance the summary
            response = await self.agents["prettifier_agent"].arun(prompt)
            
            if self.debug_output:
                print("Summary prettification completed successfully")
            
            return response.content
            
        except Exception as e:
            if self.debug_output:
                print(f"Error prettifying summary: {e}")
                print("Returning original summary without prettification")
            # Return the original summary if prettification fails
            return summary_text
    
    async def summarize_async(self, transcript_text: str, video_title: str, difficulty: str = "Normal") -> str:
        """Summarize a transcript asynchronously with memory safeguards
        
        Args:
            transcript_text (str): The full transcript text
            video_title (str): Title of the video
            difficulty (str): The desired vocabulary difficulty of the summary
            
        Returns:
            str: Generated summary
        """
        if not transcript_text:
            return "No transcript available to summarize."
        
        # Memory safeguard - limit maximum input size - use all available text
        MAX_TRANSCRIPT_SIZE = 10000000  # ~10MB text (increased from 2MB)
        if len(transcript_text) > MAX_TRANSCRIPT_SIZE:
            if self.debug_output:
                print(f"Warning: Transcript exceeds {MAX_TRANSCRIPT_SIZE/1000000:.1f}MB. Truncating to prevent memory issues.")
            transcript_text = transcript_text[:MAX_TRANSCRIPT_SIZE]
            if self.debug_output:
                print(f"Truncated transcript to {len(transcript_text)} characters")
        
        # Configure memory-safe parameters based on transcript size
        word_count = len(transcript_text.split())
        # Adaptive parameters based on transcript size
        if word_count > 50000:  # Very large transcript
            chunk_size = 6000
            overlap = 400  # Smaller overlap for large transcripts
            max_chunks = 50  # Increased from 15 to handle more content
        elif word_count > 20000:  # Large transcript
            chunk_size = 5000
            overlap = 600
            max_chunks = 40  # Increased from 20 to handle more content
        else:  # Normal transcript
            chunk_size = 4000
            overlap = 800
            max_chunks = 50  # Increased from 30 to handle more content
            
        if self.debug_output:
            print(f"Configured for transcript with {word_count} words: chunk_size={chunk_size}, "
                  f"overlap={overlap}, max_chunks={max_chunks}")
        
        try:
            # Monitor memory usage if psutil is available
            try:
                import psutil
                process = psutil.Process(os.getpid())
                initial_memory = process.memory_info().rss / 1024 / 1024
                if self.debug_output:
                    print(f"Initial memory usage: {initial_memory:.2f} MB")
                monitor_memory = True
            except ImportError:
                if self.debug_output:
                    print("psutil not available, memory monitoring disabled")
                monitor_memory = False
            
            # Step 1: Background transcript correction (async)
            if self.debug_output:
                print("Starting transcript correction...")
            corrected_transcript = await self.correct_transcript_async(transcript_text, video_title)
            
            # Monitor memory after correction
            if monitor_memory:
                current_memory = process.memory_info().rss / 1024 / 1024
                if self.debug_output:
                    print(f"Memory after correction: {current_memory:.2f} MB (delta: {current_memory - initial_memory:.2f} MB)")
            
            # Create overlapping chunks with memory safety limits
            if self.debug_output:
                print(f"Transcript is {len(corrected_transcript.split())} words, creating chunks...")
            chunks = create_overlapping_chunks(corrected_transcript, chunk_size, overlap, max_chunks)
            if self.debug_output:
                print(f"Created {len(chunks)} chunks for processing")
            
            # Clean up corrected transcript to save memory
            del corrected_transcript
            gc.collect()
            
            # Decide between parallel or sequential processing
            use_parallel = len(chunks) > 2  # Use parallel for more than 2 chunks
            
            if use_parallel:
                # Process chunks in parallel for better performance
                if self.debug_output:
                    print(f"Processing {len(chunks)} chunks in parallel...")
                chunk_summaries = await self._process_chunks_in_parallel(chunks, video_title, monitor_memory, process)
            else:
                # Process chunks sequentially for simpler tasks
                chunk_summaries = []
                if self.debug_output:
                    print(f"Processing {len(chunks)} chunks sequentially...")
                
                # Check memory before processing
                if monitor_memory:
                    current_memory = process.memory_info().rss / 1024 / 1024
                    if self.debug_output:
                        print(f"Memory before chunk processing: {current_memory:.2f} MB")
                
                # Process each chunk sequentially
                start_time = time.time()
                
                for i, chunk in enumerate(chunks):
                    # Check memory before processing chunk
                    if monitor_memory:
                        current_memory = process.memory_info().rss / 1024 / 1024
                        if self.debug_output:
                            print(f"Memory before chunk {i+1}: {current_memory:.2f} MB")
                    
                    # Process in a memory-safe way
                    try:
                        if self.debug_output:
                            print(f"Summarizing chunk {i+1} of {len(chunks)}...")
                        
                        # Try summarizing the chunk with retries
                        max_retries = 2
                        retry_count = 0
                        success = False
                        
                        while retry_count <= max_retries and not success:
                            try:
                                # If it's a retry, log it
                                if retry_count > 0:
                                    if self.debug_output:
                                        print(f"Retry #{retry_count} for chunk {i+1}...")
                                    
                                chunk_summary = await self.summarize_chunk_async(chunk, video_title, i, len(chunks))
                                chunk_summaries.append(chunk_summary)
                                success = True
                                if self.debug_output:
                                    print(f"✓ Successfully summarized chunk {i+1}")
                                
                            except Exception as chunk_error:
                                retry_count += 1
                                if retry_count <= max_retries:
                                    if self.debug_output:
                                        print(f"Error in chunk {i+1}, will retry: {chunk_error}")
                                    # Wait before retrying
                                    await asyncio.sleep(1)
                                else:
                                    # All retries failed
                                    raise chunk_error
                        
                        # Clear chunk from memory
                        del chunk
                        
                        # Force aggressive garbage collection after each chunk
                        gc.collect()
                        
                        # Small delay to prevent overwhelming the system
                        await asyncio.sleep(0.2)
                        
                        # Monitor memory after processing chunk
                        if monitor_memory:
                            current_memory = process.memory_info().rss / 1024 / 1024
                            if self.debug_output:
                                print(f"Memory after chunk {i+1}: {current_memory:.2f} MB")
                        
                    except Exception as e:
                        if self.debug_output:
                            print(f"❌ Error processing chunk {i+1} after all retries: {e}")
                        
                        # Create a fallback summary for the chunk
                        fallback_summary = self._create_fallback_chunk_summary(chunk, i+1)
                        chunk_summaries.append(fallback_summary)
                        
                        if self.debug_output:
                            print(f"Added fallback summary for chunk {i+1}")
                
                # Calculate processing time
                processing_time = time.time() - start_time
                chunks_per_second = len(chunks) / processing_time if processing_time > 0 else 0
                if self.debug_output:
                    print(f"Processed {len(chunks)} chunks in {processing_time:.2f}s ({chunks_per_second:.2f} chunks/sec)")
            
            # Log summary of chunk processing results
            successful_chunks = sum(1 for s in chunk_summaries if not s.startswith('[') and not "Fallback Summary" in s)
            fallback_chunks = sum(1 for s in chunk_summaries if "Fallback Summary" in s)
            failed_chunks = sum(1 for s in chunk_summaries if s.startswith('[') and not "Fallback Summary" in s)
            
            if self.debug_output:
                print("\n" + "="*50)
                print(f"CHUNK PROCESSING SUMMARY:")
                print(f"✓ Successfully processed: {successful_chunks}/{len(chunks)} chunks")
                if fallback_chunks > 0:
                    print(f"⚠️ Fallback summaries used: {fallback_chunks}/{len(chunks)} chunks")
                if failed_chunks > 0:
                    print(f"❌ Failed processing: {failed_chunks}/{len(chunks)} chunks")
                print("="*50 + "\n")
            
            # Create comprehensive summary from all chunks (async)
            if self.debug_output:
                print("Creating comprehensive summary from all chunks...")
            summary = await self.create_comprehensive_summary_async(chunk_summaries, video_title, transcript_text, difficulty)
            
            # Final memory check
            if monitor_memory:
                current_memory = process.memory_info().rss / 1024 / 1024
                if self.debug_output:
                    print(f"Final memory usage: {current_memory:.2f} MB (delta: {current_memory - initial_memory:.2f} MB)")
            
            return summary
            
        except Exception as e:
            if self.debug_output:
                print(f"Error using Agno agent for summarization: {e}")
            
            # Memory cleanup in case of error
            gc.collect()
            
            # Check if we have partial summaries that we can use
            if 'chunk_summaries' in locals() and chunk_summaries and len(chunk_summaries) > 0:
                try:
                    # Try to create a summary from the chunks we have
                    if self.debug_output:
                        print(f"Attempting to create summary from {len(chunk_summaries)} partial chunks...")
                    partial_summary = "⚠️ **Partial Summary** ⚠️\n\n"
                    partial_summary += "This is an incomplete summary due to a processing error.\n\n"
                    
                    # Join the partial summaries directly
                    partial_summary += "\n\n".join(chunk_summaries[:5])  # Limit to first 5 chunks to avoid memory issues
                    return partial_summary
                except Exception as inner_e:
                    if self.debug_output:
                        print(f"Error creating partial summary: {inner_e}")
                    # Continue to fallback method
            
            # Generate a basic summary as a fallback when all else fails
            if self.debug_output:
                print("Falling back to basic summary generation...")
            
            # Truncate input for the fallback to avoid memory issues
            truncated_text = transcript_text[:100000] if len(transcript_text) > 100000 else transcript_text
            return generate_basic_summary(truncated_text, video_title)
    
    def summarize(self, transcript_text: str, video_title: str, difficulty: str = "Normal") -> str:
        """Synchronous wrapper for async summarization
        
        Args:
            transcript_text (str): The full transcript text
            video_title (str): Title of the video
            difficulty (str): The desired vocabulary difficulty of the summary
            
        Returns:
            str: Generated summary
        """
        # Run the async summarization in the event loop
        return asyncio.run(self.summarize_async(transcript_text, video_title, difficulty))


# Standalone functions for backward compatibility
async def summarize_transcript_async(transcript_text: str, video_title: str, debug_output: bool = True, difficulty: str = "Normal") -> str:
    """Async function to summarize a transcript
    
    Args:
        transcript_text (str): The full transcript text
        video_title (str): Title of the video
        debug_output (bool): Whether to print debugging information
        difficulty (str): The desired vocabulary difficulty of the summary
        
    Returns:
        str: Generated summary
    """
    summarizer = TranscriptSummarizer(debug_output=debug_output)
    return await summarizer.summarize_async(transcript_text, video_title, difficulty)

def summarize_transcript(transcript_text: str, video_title: str, debug_output: bool = True, difficulty: str = "Normal") -> str:
    """Synchronous function to summarize a transcript
    
    Args:
        transcript_text (str): The full transcript text
        video_title (str): Title of the video
        debug_output (bool): Whether to print debugging information
        difficulty (str): The desired vocabulary difficulty of the summary
        
    Returns:
        str: Generated summary
    """
    summarizer = TranscriptSummarizer(debug_output=debug_output)
    return summarizer.summarize(transcript_text, video_title, difficulty)
