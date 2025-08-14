"""
Agent definitions for transcript summarization

This module defines all Agno agents used in the summarization process and configures them as a team
"""

from agno.agent import Agent
from agno.team import Team
from agno.models.azure import AzureOpenAI
import os
import dotenv
import sys

# Load environment variables from .env.local
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), '.env.local')
dotenv.load_dotenv(env_path)
print(f"Loading environment from: {env_path}")

# Print the loaded environment variables (for debugging)
print(f"AZURE_OPENAI_API_KEY: {'set' if os.getenv('AZURE_OPENAI_API_KEY') else 'not set'}")
print(f"AZURE_OPENAI_ENDPOINT: {os.getenv('AZURE_OPENAI_ENDPOINT')}")
print(f"AZURE_OPENAI_API_VERSION: {os.getenv('AZURE_OPENAI_API_VERSION', '2024-12-01-preview')}")

def get_llm():
    """Get the LLM instance"""
    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")
    
    if not api_key or not endpoint:
        print("ERROR: Azure OpenAI credentials not found in environment variables")
        print(f"API Key: {'set' if api_key else 'not set'}, Endpoint: {'set' if endpoint else 'not set'}")
        sys.exit(1)
    
    print(f"Creating Azure OpenAI model with deployment: gpt-4-1")
    
    # Use GPT-4 from Azure OpenAI
    return AzureOpenAI(
        api_key=api_key,
        api_version=api_version,
        azure_endpoint=endpoint,
        azure_deployment="gpt-4-1"
    )

def get_reasoning_llm():
    """Get the reasoning LLM instance"""
    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")
    
    if not api_key or not endpoint:
        print("ERROR: Azure OpenAI credentials not found in environment variables")
        print(f"API Key: {'set' if api_key else 'not set'}, Endpoint: {'set' if endpoint else 'not set'}")
        sys.exit(1)
        
    print(f"Creating Azure OpenAI model with deployment: o4-mini")
    
    return AzureOpenAI(
        api_key=api_key,
        api_version=api_version,
        azure_endpoint=endpoint,
        azure_deployment="o4-mini"
    )

def create_agents():
    """Create all the agents needed for the summarization pipeline
    
    Returns:
        dict: Dictionary containing all agent instances and teams
    """
    llm = get_llm()
    reasoning_llm = get_reasoning_llm()
    
    # Create the correction agent
    correction_agent = Agent(
        name="TranscriptCorrector",
        model=llm,
        description="An agent that corrects transcript errors while preserving meaning"
    )

    # Create a comprehensive summary agent
    comprehensive_agent = Agent(
        name="ComprehensiveSummarizer",
        model=llm,
        description="An agent that creates unified summaries from multiple chunks"
    )

    # Create a single chunk summarizer agent to use individually
    chunk_agent = Agent(
        name="ChunkSummarizer",
        model=llm,
        description="An agent that summarizes video transcript chunks"
    )
    
    # For now, use a sequential approach instead of team-based
    # We'll use the same agent multiple times rather than a team

    # Create a genre detection agent
    genre_detection_agent = Agent(
        name="GenreDetector",
        model=reasoning_llm,
        description="An agent that detects video genre and content type"
    )
    
    return {
        "correction_agent": correction_agent,
        "comprehensive_agent": comprehensive_agent,
        "chunk_agent": chunk_agent,
        "genre_detection_agent": genre_detection_agent,
        "llm": llm,
        "reasoning_llm": reasoning_llm
    }