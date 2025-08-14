#!/bin/bash

echo "🚀 Setting up Video Learning Web App environment..."

# Check if Python 3.12+ is installed
python_version=$(python3 --version 2>&1 | grep -oE 'Python [0-9]+\.[0-9]+' | cut -d' ' -f2)
if [[ "$(echo "$python_version >= 3.12" | bc -l)" -eq 1 ]]; then
    echo "✅ Python $python_version detected"
else
    echo "❌ Python 3.12+ required. Found: $python_version"
    exit 1
fi

# Check if Node.js 18+ is installed
node_version=$(node --version 2>&1 | grep -oE 'v[0-9]+' | cut -c2-)
if [[ "$node_version" -ge 18 ]]; then
    echo "✅ Node.js v$node_version detected"
else
    echo "❌ Node.js 18+ required. Found: v$node_version"
    exit 1
fi

# Check if uv is installed
if command -v uv &> /dev/null; then
    echo "✅ uv package manager detected"
else
    echo "📦 Installing uv package manager..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    source ~/.bashrc 2>/dev/null || source ~/.zshrc 2>/dev/null
fi

# Check if yt-dlp is installed
if command -v yt-dlp &> /dev/null; then
    echo "✅ yt-dlp detected"
else
    echo "📦 Installing yt-dlp..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install yt-dlp
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo apt update && sudo apt install -y yt-dlp
    else
        pip3 install yt-dlp
    fi
fi

echo "📦 Installing Python dependencies..."
uv sync

echo "📦 Installing Node.js dependencies..."
npm install

echo "🔧 Creating environment file..."
if [ ! -f .env.local ]; then
    cat > .env.local << EOF
# YouTube API Key (required)
YOUTUBE_API_KEY=your_youtube_api_key_here

# Azure OpenAI Configuration (required for AI features)
AZURE_OPENAI_API_KEY=your_azure_openai_api_key_here
AZURE_OPENAI_API_VERSION=2024-12-01-preview
AZURE_OPENAI_ENDPOINT=https://your-azure-endpoint.openai.azure.com/

# Python environment (optional - auto-detected)
# VIRTUAL_ENV=/path/to/your/venv
# PYTHONPATH=/path/to/your/project
EOF
    echo "📝 Created .env.local - please update with your API keys"
else
    echo "✅ .env.local already exists"
fi

echo "🎉 Setup complete! Run 'npm run dev' to start development server"
echo "📝 Don't forget to update .env.local with your API keys"
