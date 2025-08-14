from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import uvicorn

app = FastAPI(title="Video Learning API")

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8051"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Sample data - In a real app, this would be in a database
sample_videos = [
    {
        "id": "1",
        "title": "Introduction to JavaScript",
        "description": "Learn the basics of JavaScript programming language",
        "thumbnail": "https://placehold.co/800x450/0070f3/FFFFFF/png?text=JavaScript",
        "duration": "10:30",
        "views": "12,345",
        "tags": ["JavaScript", "Programming", "Beginner"],
        "difficulty": "beginner"
    },
    {
        "id": "2",
        "title": "React Hooks Explained",
        "description": "Everything you need to know about React Hooks",
        "thumbnail": "https://placehold.co/800x450/34a853/FFFFFF/png?text=React",
        "duration": "15:45",
        "views": "8,765",
        "tags": ["React", "JavaScript", "Intermediate"],
        "difficulty": "intermediate"
    },
    {
        "id": "3",
        "title": "Building a REST API with Node.js",
        "description": "Step by step guide to creating a RESTful API",
        "thumbnail": "https://placehold.co/800x450/fbbc05/FFFFFF/png?text=Node.js",
        "duration": "20:15",
        "views": "5,432",
        "tags": ["Node.js", "API", "Backend"],
        "difficulty": "intermediate"
    },
    {
        "id": "4",
        "title": "Advanced TypeScript Features",
        "description": "Dive into advanced TypeScript concepts and techniques",
        "thumbnail": "https://placehold.co/800x450/4285f4/FFFFFF/png?text=TypeScript",
        "duration": "25:10",
        "views": "3,456",
        "tags": ["TypeScript", "Programming", "Advanced"],
        "difficulty": "advanced"
    },
    {
        "id": "5",
        "title": "CSS Grid Layout Tutorial",
        "description": "Master CSS Grid Layout for modern web designs",
        "thumbnail": "https://placehold.co/800x450/db4437/FFFFFF/png?text=CSS+Grid",
        "duration": "18:20",
        "views": "9,876",
        "tags": ["CSS", "Web Design", "Beginner"],
        "difficulty": "beginner"
    }
]


# Models
class Video(BaseModel):
    id: str
    title: str
    description: str
    thumbnail: str
    duration: str
    views: str
    tags: List[str]
    difficulty: str


class VideoDetail(Video):
    transcript: Optional[str] = None
    ai_summary: Optional[str] = None
    quiz_questions: Optional[List[dict]] = None
    ai_insights: Optional[List[dict]] = None


class SearchResult(BaseModel):
    results: List[Video]
    total: int


# API routes
@app.get("/")
async def root():
    return {"message": "Video Learning API is running"}


@app.get("/api/videos", response_model=SearchResult)
async def search_videos(
    query: Optional[str] = None,
    difficulty: Optional[str] = None,
    tag: Optional[str] = None,
    limit: int = Query(10, ge=1, le=50),
    offset: int = Query(0, ge=0)
):
    # Filter videos based on query parameters
    filtered_videos = sample_videos
    
    if query:
        filtered_videos = [
            v for v in filtered_videos 
            if query.lower() in v["title"].lower() or query.lower() in v["description"].lower()
        ]
    
    if difficulty:
        filtered_videos = [v for v in filtered_videos if v["difficulty"] == difficulty]
    
    if tag:
        filtered_videos = [v for v in filtered_videos if tag in v["tags"]]
    
    # Apply pagination
    paginated_videos = filtered_videos[offset:offset + limit]
    
    return {
        "results": paginated_videos,
        "total": len(filtered_videos)
    }


@app.get("/api/videos/{video_id}", response_model=VideoDetail)
async def get_video(video_id: str):
    for video in sample_videos:
        if video["id"] == video_id:
            # Create a copy of the video and add additional details
            video_detail = dict(video)
            video_detail["transcript"] = "This is a sample transcript for video " + video_id
            video_detail["ai_summary"] = "This video covers important concepts related to " + video["title"]
            video_detail["quiz_questions"] = [
                {
                    "id": "q1",
                    "question": "What is the main topic of this video?",
                    "options": ["Option A", "Option B", "Option C", "Option D"],
                    "correct_answer": "Option A"
                },
                {
                    "id": "q2",
                    "question": "Which concept was explained in detail?",
                    "options": ["Concept X", "Concept Y", "Concept Z", "None of the above"],
                    "correct_answer": "Concept Y"
                }
            ]
            video_detail["ai_insights"] = [
                {
                    "timestamp": "00:45",
                    "text": "Key concept explanation"
                },
                {
                    "timestamp": "03:12",
                    "text": "Important distinction to note"
                },
                {
                    "timestamp": "07:30",
                    "text": "Common misconception clarified"
                }
            ]
            return video_detail
    
    raise HTTPException(status_code=404, detail="Video not found")


@app.get("/api/trending")
async def get_trending_videos(limit: int = Query(5, ge=1, le=10)):
    # In a real app, this would return videos based on view counts, likes, etc.
    return {
        "results": sample_videos[:limit],
        "total": len(sample_videos)
    }


@app.get("/api/recommended")
async def get_recommended_videos(user_id: Optional[str] = None, limit: int = Query(5, ge=1, le=10)):
    # In a real app, this would return personalized recommendations
    # For now, just return sample videos
    return {
        "results": sample_videos[:limit],
        "total": len(sample_videos)
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
