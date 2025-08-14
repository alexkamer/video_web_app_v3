# Video Learning App - Test Instructions

## How to Access and Test Quiz Mode

To properly test the quiz mode and other features in the Video Learning App, follow these instructions. You can access the quiz mode through either the `/video/[id]` or `/watch/[id]` routes:

### Prerequisites
- Make sure the development server is running (`npm run dev`)
- You need a valid YouTube video ID to test with

### Option 1: Access Through the Video Page
1. Open your browser and go to: `http://localhost:3000/video/dQw4w9WgXcQ`
   - Replace `dQw4w9WgXcQ` with any valid YouTube video ID if needed
   - This is the test URL with Rick Astley's "Never Gonna Give You Up" for demonstration

### Option 2: Access Through the Watch Page
1. Open your browser and go to: `http://localhost:3000/watch/dQw4w9WgXcQ`
   - Replace `dQw4w9WgXcQ` with any valid YouTube video ID if needed
   - The Watch page has a slightly different layout but offers the same functionality

### Step 2: Using the Mode Buttons
1. When the page loads, you should see three mode buttons either below the video player (on the `/video/[id]` page) or in the action buttons section (on the `/watch/[id]` page):
   - 👁️ Watch Mode (default)
   - 📚 Learn Mode
   - ✅ Quiz Mode

2. Click on the **✅ Quiz Mode** button to activate the quiz feature
   - The page URL will update to include `?mode=quiz` parameter
   - The quiz overlay should appear over the video player
   - The video should pause automatically

### Step 3: Using the Quiz Feature
1. When you activate Quiz Mode, questions are automatically generated in the background
   - You'll see a loading indicator with progress percentage while questions are being prepared
   - Once generated, the video will continue playing normally
2. Questions will appear at specific timestamps throughout the video
   - When a timestamp is reached, the video will automatically pause
   - A question related to that part of the video will be displayed
3. Answer each question by clicking on an option
4. Click "Next Question" to continue watching the video
   - The video will resume playback until the next question timestamp is reached
5. After all questions are answered, your final score will be displayed
6. Click "Continue Watching" to resume normal video playback

### Alternative Direct URL Access
You can also directly access any mode by using the appropriate URL parameters:

For the video page:
- Watch mode: `http://localhost:3000/video/dQw4w9WgXcQ?mode=watch`
- Learn mode: `http://localhost:3000/video/dQw4w9WgXcQ?mode=learn`
- Quiz mode: `http://localhost:3000/video/dQw4w9WgXcQ?mode=quiz`

For the watch page:
- Watch mode: `http://localhost:3000/watch/dQw4w9WgXcQ?mode=watch`
- Learn mode: `http://localhost:3000/watch/dQw4w9WgXcQ?mode=learn`
- Quiz mode: `http://localhost:3000/watch/dQw4w9WgXcQ?mode=quiz`

### Troubleshooting
If you don't see the mode buttons or they're not functioning:
1. Make sure you're on a page with a valid YouTube video ID
2. Check browser console for any JavaScript errors
3. Try clearing your browser cache or using a private/incognito window
4. Ensure all dependencies are installed (`npm install`)
5. Restart the development server (`npm run dev`)

### Developer Notes
- The quiz questions are generated based on the video's transcript
- The current implementation uses a simple algorithm to extract keywords from the transcript
- In production, this would be enhanced with more sophisticated AI-based question generation