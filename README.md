# Video Learning Web App

An interactive web application for searching, watching, and learning from educational videos with AI-powered features including transcript generation, summarization, and quiz generation.

## 🚀 Features

### Content Discovery & Exploration
- Search for videos on specific topics using YouTube API
- Browse trending, recommended, or new videos
- Filter videos by learning level, length, and popularity

### Flexible Video Interaction
- Watch videos without interruption using embedded YouTube player
- Learn Mode with AI-powered insights and explanations
- Quiz Mode to test understanding during video playback

### AI Assistance & Personalization
- Quick AI summaries of video content using AGNO agent
- Chat with AI assistant about video topics
- Personalized video recommendations
- Bookmark and save videos for later

### Active Learning & Knowledge Checking
- Interactive quizzes on video content
- Immediate feedback on quiz answers
- Progress tracking for quizzes
- Request additional practice questions

### Convenience & Usability
- Resume watching from where you left off
- Control playback speed, subtitles, and quality
- Access AI-generated transcripts and notes
- Share videos and quiz results

## 🛠️ Technology Stack

- **Frontend**: Next.js 15, React 18
- **Backend**: Node.js API routes with Python integration
- **AI Services**: Azure OpenAI API for summaries and insights
- **Video Processing**: yt-dlp for transcript extraction
- **Package Management**: uv for Python (latest versions), npm for Node.js
- **Dependencies**: All packages use latest versions for easy development and deployment

## 📋 Prerequisites

- Node.js 18+ and npm
- Python 3.12+
- uv (Python package manager)
- yt-dlp (for video transcript extraction)

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd video_web_app
```

### 2. Install Dependencies

**Option 1: Quick Setup (Recommended)**
```bash
./setup.sh
```

**Option 2: Manual Setup**

**Frontend (Node.js):**
```bash
npm install
```

**Backend (Python):**
```bash
uv sync
```

### 3. Environment Setup

Create a `.env.local` file in the root directory:

```bash
# YouTube API Key (required)
YOUTUBE_API_KEY=your_youtube_api_key_here

# Azure OpenAI Configuration (required for AI features)
AZURE_OPENAI_API_KEY=your_azure_openai_api_key_here
AZURE_OPENAI_API_VERSION=2024-12-01-preview
AZURE_OPENAI_ENDPOINT=https://your-azure-endpoint.openai.azure.com/

# Python environment (optional - auto-detected)
VIRTUAL_ENV=/path/to/your/venv
PYTHONPATH=/path/to/your/project
```

### 4. Run the Development Server
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## 🔧 API Endpoints

### YouTube Integration
- `GET /api/youtube/search` - Search YouTube videos
- `GET /api/youtube/video/[id]` - Get video details
- `GET /api/youtube/transcript/[id]` - Get video transcript
- `GET /api/youtube/summarize` - Generate AI summary
- `GET /api/youtube/related/[id]` - Get related videos

### AI Features
- `POST /api/youtube/summarize` - Generate video summaries using AGNO agent
- Transcript processing with yt-dlp
- Markdown rendering for AI summaries

## 📁 Project Structure

```
video_web_app/
├── components/          # React components
│   ├── AISummary.js    # AI summary display
│   ├── TranscriptViewer.js # Transcript display
│   └── ...
├── pages/              # Next.js pages and API routes
│   ├── api/youtube/    # YouTube API integration
│   └── video/[id].js   # Video player page
├── scripts/            # Python scripts
│   └── summarize_transcript_with_agnos.py # AGNO agent integration
├── utils/              # Utility functions
│   ├── aiSummarizer.js # AI summary generation
│   ├── transcriptFetcher.js # Transcript extraction
│   └── ...
├── styles/             # CSS modules
└── public/             # Static assets
```

## 🔐 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `YOUTUBE_API_KEY` | YouTube Data API v3 key | Yes |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API key | Yes |
| `AZURE_OPENAI_API_VERSION` | Azure OpenAI API version | Yes |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint URL | Yes |

## 🧪 Development

### Environment Management
- **Python**: Uses `uv` for dependency management with latest package versions
- **Node.js**: Uses `npm` with flexible versioning (^) for easy updates
- **Dependencies**: All version pins removed for smooth development workflow

### Running Tests
```bash
npm run lint
```

### Building for Production
```bash
npm run build
npm start
```

### Updating Dependencies
```bash
# Update Python packages to latest versions
uv sync --upgrade

# Update Node.js packages to latest versions
npm update
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- YouTube Data API for video search and metadata
- Azure OpenAI for AI-powered features
- yt-dlp for video transcript extraction
- Next.js and React for the frontend framework