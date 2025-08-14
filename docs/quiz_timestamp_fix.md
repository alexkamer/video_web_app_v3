# Quiz Timestamp Assignment Fix

## Problem Identified

We identified an issue with the video quiz feature where questions weren't appearing correctly when skipping through videos. Our investigation revealed that quiz questions were being assigned timestamps that extended beyond the actual video duration. For example, in a 75-second video, questions were being assigned timestamps at 110s, 130s, and 170s, making them impossible to trigger during normal video playback.

## Root Cause Analysis

The root cause was in the `assignTimestampsToQuestions` function in `pages/api/youtube/generate-quiz.js`:

1. The function was calculating total video duration incorrectly, using only the start time of the last transcript segment
2. There was no validation to ensure timestamps stayed within the video's duration
3. Question timestamps were assigned proportionally throughout the video without proper bounds checking

## Solution

We've improved the timestamp assignment algorithm with these key changes:

1. **Better Duration Calculation**:
   - Uses the end time of the last segment when available
   - Adds a reasonable buffer to the start time when end time is not available
   - Sets a sensible fallback duration when segment information is limited

2. **Improved Timestamp Distribution**:
   - Sets a safe boundary at 90% of the video duration to avoid exceeding the actual video length
   - Distributes questions between 15% and 85% of the video duration to avoid intro/outro sections
   - Ensures minimum spacing (at least 10 seconds) between questions

3. **Added Validation**:
   - Questions with timestamps beyond the video duration are re-assigned within valid bounds
   - All timestamps are validated to ensure they don't exceed the video duration
   - Questions are sorted chronologically for consistent presentation

4. **Enhanced Debugging**:
   - Added logging for total video duration
   - Added logging for timestamp distribution ranges
   - Added logging of final question timestamps with percentage of video duration

## Testing

The solution has been thoroughly tested with:

1. **Unit Testing**:
   - Tested timestamp assignment with different transcript lengths
   - Verified questions remain within the video duration

2. **Debug Output Tests**:
   - Added comprehensive debugging to the VideoQuiz component
   - Created a test script to validate question appearance logic

3. **Integration Testing**:
   - Tested the API endpoint to ensure it returns valid timestamps
   - Verified question display behavior in various skip scenarios

## Expected Behavior

With these changes, quiz questions will:

1. Appear at appropriate timestamps throughout the video
2. Never be assigned timestamps beyond the video duration
3. Be distributed evenly with reasonable spacing
4. Be shown when skipping past their timestamps

The fix ensures that users will see all quiz questions whether they watch the full video or skip through it.