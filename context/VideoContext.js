import { createContext, useContext, useState, useEffect } from 'react';

const VideoContext = createContext();

export function useVideoContext() {
  return useContext(VideoContext);
}

export function VideoProvider({ videoId, children }) {
  const [videoDetails, setVideoDetails] = useState(null);
  const [summary, setSummary] = useState(null);
  const [transcript, setTranscript] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!videoId) return;

    async function fetchAllVideoData() {
      setLoading(true);
      try {
        // First, fetch the transcript and video details
        const [transcriptRes, videoDetailsRes] = await Promise.all([
          fetch(`/api/youtube/transcript/${videoId}`),
          fetch(`/api/youtube/video/${videoId}`),
        ]);

        if (!transcriptRes.ok) throw new Error('Failed to fetch transcript');
        if (!videoDetailsRes.ok) throw new Error('Failed to fetch video details');

        const transcriptData = await transcriptRes.json();
        const videoDetailsData = await videoDetailsRes.json();

        setTranscript(transcriptData);
        setVideoDetails(videoDetailsData);

        // Now, fetch the summary and quiz data using the transcript and video details
        const [summaryRes, quizRes] = await Promise.all([
          fetch(`/api/youtube/summarize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              transcript: transcriptData.transcript, 
              videoTitle: videoDetailsData.items[0].snippet.title,
              videoId: videoId
            }),
          }),
          fetch(`/api/youtube/generate-quiz`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              transcript: transcriptData.transcript, 
              summary: null, // Summary is not available yet, but the API can handle it
              videoId: videoId 
            }),
          }),
        ]);

        if (!summaryRes.ok) throw new Error('Failed to fetch summary');
        if (!quizRes.ok) throw new Error('Failed to fetch quiz');

        const summaryData = await summaryRes.json();
        const quizData = await quizRes.json();

        setSummary(summaryData);
        setQuiz(quizData);

      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchAllVideoData();
  }, [videoId]);

  const value = {
    videoDetails,
    summary,
    transcript,
    quiz,
    loading,
    error,
  };

  return (
    <VideoContext.Provider value={value}>
      {children}
    </VideoContext.Provider>
  );
}