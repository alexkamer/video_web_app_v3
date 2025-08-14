#!/usr/bin/env python3
"""
Test Azure OpenAI Configuration

This script tests the Azure OpenAI configuration to ensure it's working correctly.
"""

import os
import sys
import dotenv
from openai import AzureOpenAI

# Load environment variables from .env.local
dotenv.load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env.local'))

def test_azure_config():
    """Test Azure OpenAI configuration"""
    
    print("Testing Azure OpenAI Configuration")
    print("=" * 50)
    
    # Check environment variables
    api_key = os.getenv('AZURE_OPENAI_API_KEY')
    endpoint = os.getenv('AZURE_OPENAI_ENDPOINT')
    api_version = os.getenv('AZURE_OPENAI_API_VERSION', '2024-12-01-preview')
    deployment = os.getenv('AZURE_OPENAI_DEPLOYMENT', 'gpt-4-1')
    
    print(f"API Key: {'✓ Set' if api_key else '✗ Not set'}")
    print(f"Endpoint: {endpoint or '✗ Not set'}")
    print(f"API Version: {api_version}")
    print(f"Deployment: {deployment}")
    
    if not api_key or not endpoint:
        print("\n❌ Missing required environment variables!")
        print("Please set AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT in your .env.local file")
        return False
    
    try:
        # Initialize client
        client = AzureOpenAI(
            azure_endpoint=endpoint,
            api_key=api_key,
            api_version=api_version
        )
        
        print("\n✓ Azure OpenAI client initialized successfully")
        
        # Test a simple completion
        print(f"\nTesting deployment: {deployment}")
        
        response = client.chat.completions.create(
            model=deployment,
            messages=[
                {"role": "user", "content": "Hello! Please respond with 'Azure OpenAI is working correctly.'"}
            ],
            max_tokens=50
        )
        
        result = response.choices[0].message.content
        print(f"✓ Test successful! Response: {result}")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Error testing Azure OpenAI: {e}")
        
        if "DeploymentNotFound" in str(e):
            print("\n🔧 Troubleshooting tips:")
            print("1. Check that the deployment name is correct")
            print("2. Verify the deployment exists in your Azure OpenAI resource")
            print("3. Ensure the deployment is active and not in a failed state")
            print("4. Check that your API key has access to this deployment")
        
        return False

if __name__ == "__main__":
    success = test_azure_config()
    sys.exit(0 if success else 1)
