import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Script from 'next/script';
import styles from '../../styles/VideoPage.module.css';
import SimpleTranscriptViewer from '../../components/SimpleTranscriptViewer';
import AISummary from '../../components/AISummary';
import YouTubeEmbedPlayer from '../../components/YouTubeEmbedPlayer';
import VideoQuiz from '../../components/VideoQuiz';

export default function VideoPage() {
  const router = useRouter();
  const { id, mode: initialMode, t: urlTimestamp } = router.query;
  const [mode, setMode] = useState('watch'); // 'watch', 'learn', or 'quiz'
  const [isTranscriptVisible, setIsTranscriptVisible] = useState(false); // Control transcript panel visibility
  const [transcript, setTranscript] = useState([]);
  const [currentTimestamp, setCurrentTimestamp] = useState(urlTimestamp ? parseInt(urlTimestamp) : 0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playerInstance, setPlayerInstance] = useState(null);
  
  const [summary, setSummary] = useState('');

  // Function to handle transcript segment clicks - use URL-based approach for consistent autoplay behavior
  const handleTranscriptClick = (segment) => {
    if (!segment || !segment.start) return;
    
    console.log(`VideoPage: Transcript segment clicked at ${segment.start}s`);
    
    // Use navigateToTimestamp which simulates a page reload
    if (typeof window !== 'undefined' && window.navigateToTimestamp) {
      try {
        window.navigateToTimestamp(id, segment.start);
      } catch (e) {
        console.error('Error navigating to timestamp:', e);
        
        // Fallback - just update state
        setCurrentTimestamp(segment.start);
      }
    } else {
      // Fallback if navigation function not available
      setCurrentTimestamp(segment.start);
      
      // Direct iframe approach as fallback
      try {
        const iframe = document.getElementById('youtube-player');
        if (iframe && id) {
          const timestamp = Math.floor(segment.start);
          const newSrc = `https://www.youtube.com/embed/${id}?autoplay=1&start=${timestamp}`;
          iframe.src = newSrc;
        }
      } catch (e) {
        console.error('Error with fallback approach:', e);
      }
    }
  };
  
  // Store videoId in window for components to access
  useEffect(() => {
    if (id && typeof window !== 'undefined') {
      window.currentVideoId = id;
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        delete window.currentVideoId;
      }
    };
  }, [id]);
  
  // Update mode when the URL changes
  useEffect(() => {
    if (initialMode && ['watch', 'learn', 'quiz'].includes(initialMode)) {
      setMode(initialMode);
    }
  }, [initialMode]);

  // Sample video data - in a real app, this would be fetched based on ID
  const videoData = {
    id: id,
    title: 'Sample Video Title',
    description: 'This is a detailed description of the video content. It would include information about what the video covers, who it is for, and what viewers can expect to learn.',
    videoUrl: 'https://www.example.com/sample-video.mp4',
    thumbnail: 'https://placehold.co/800x450/0070f3/FFFFFF/png?text=Video+Player',
    duration: '15:30',
    views: '10,234',
    tags: ['JavaScript', 'Programming', 'Web Development'],
    transcript: `
      This is a sample transcript of the video content.
      It would contain the full text of what is spoken in the video.
      This allows users to read along or search for specific content.
      In a real application, this would be generated automatically or provided by the content creator.
    `
  };

  // Sample quiz questions
  const quizQuestions = [
    {
      id: 1,
      question: 'What is the main topic of this video?',
      options: [
        'JavaScript basics',
        'Advanced CSS techniques',
        'Database design',
        'Network protocols'
      ],
      correctAnswer: 'JavaScript basics'
    },
    {
      id: 2,
      question: 'Which concept was NOT covered in this video?',
      options: [
        'Variables',
        'Functions',
        'Classes',
        'WebSockets'
      ],
      correctAnswer: 'WebSockets'
    }
  ];

  return (
    <div className={styles.container}>
      <Head>
        <title>{videoData.title} | Video Learning App</title>
        <meta name="description" content={videoData.description} />
      </Head>
      
      <Script src="/reload-approach.js" strategy="beforeInteractive" />

      <main className={styles.main}>
        <div className={styles.mainContentContainer}>
          {/* Left side: Video player */}
          <div className={styles.videoContainer}>
            {/* YouTube Player Component */}
            {id && (
              <div className={styles.videoPlayer}>
                <YouTubeEmbedPlayer 
                  videoId={id} 
                  timestamp={currentTimestamp}
                  onPlayerReady={player => {
                    // Store global reference
                    if (typeof window !== 'undefined') {
                      window.youtubePlayer = player;
                      
                      // Set up time tracking interval
                      const timeTrackingInterval = setInterval(() => {
                        try {
                          if (player && typeof player.getCurrentTime === 'function') {
                            setCurrentTime(player.getCurrentTime());
                          }
                        } catch (e) {
                          console.error('Error getting current time:', e);
                        }
                      }, 500);
                      
                      // Store for cleanup
                      window.timeTrackingInterval = timeTrackingInterval;
                    }
                    setPlayerInstance(player);
                    console.log('YouTube player instance ready:', player);
                  }}
                  onStateChange={state => {
                    // Update current time whenever video is playing
                    if (state === 1 && playerInstance) { // 1 = playing
                      setCurrentTime(playerInstance.getCurrentTime());
                    }
                  }} 
                />
                
                {/* Quiz overlay */}
                {mode === 'quiz' && (
                  <VideoQuiz
                    videoId={id}
                    transcript={transcript}
                    summary={summary}
                    isActive={mode === 'quiz'}
                    currentTime={currentTime}
                    onQuizComplete={(result) => {
                      console.log('Quiz completed with score:', result.score);
                    }}
                    onPauseVideo={() => {
                      if (playerInstance && typeof playerInstance.pauseVideo === 'function') {
                        playerInstance.pauseVideo();
                      }
                    }}
                    onResumeVideo={() => {
                      if (playerInstance && typeof playerInstance.playVideo === 'function') {
                        playerInstance.playVideo();
                      }
                    }}
                  />
                )}
              </div>
            )}
            <div className={styles.videoControls}>
              <button 
                className={`${styles.modeButton} ${mode === 'watch' ? styles.active : ''}`}
                onClick={() => {
                  setMode('watch');
                  router.push(`/video/${id}?mode=watch`, undefined, { shallow: true });
                }}
              >
                <span>👁️ Watch Mode</span>
              </button>
              <button 
                className={`${styles.modeButton} ${mode === 'learn' ? styles.active : ''}`}
                onClick={() => {
                  setMode('learn');
                  router.push(`/video/${id}?mode=learn`, undefined, { shallow: true });
                }}
              >
                <span>📚 Learn Mode</span>
              </button>
              <button 
                className={`${styles.modeButton} ${mode === 'quiz' ? styles.active : ''}`}
                onClick={() => {
                  setMode('quiz');
                  router.push(`/video/${id}?mode=quiz`, undefined, { shallow: true });
                }}
                disabled={!summary}
              >
                <span>✅ Quiz Mode</span>
              </button>
            </div>
          </div>
          
          {/* Right side: Transcript panel (collapsed by default) */}
          <div className={`${styles.transcriptPanel} ${!isTranscriptVisible ? styles.collapsed : ''}`}>
            {id && (
              <SimpleTranscriptViewer 
                videoId={id} 
                onTranscriptLoaded={setTranscript} 
                onSegmentClick={handleTranscriptClick} 
              />
            )}
          </div>
        </div>

        <div className={styles.videoInfo}>
          <div className={styles.titleRow}>
            <h1>{videoData.title}</h1>
            <button 
              className={styles.transcriptToggle}
              onClick={() => setIsTranscriptVisible(!isTranscriptVisible)}
            >
              {isTranscriptVisible ? 'Hide Transcript' : 'Show Transcript'}
            </button>
          </div>
          <div className={styles.meta}>
            <span>{videoData.views} views</span>
            <span>{videoData.duration}</span>
            <div className={styles.tags}>
              {videoData.tags.map(tag => (
                <span key={tag} className={styles.tag}>{tag}</span>
              ))}
            </div>
          </div>
          <p className={styles.description}>{videoData.description}</p>
        </div>

        <div className={styles.contentSection}>
          {/* AI Summary shown below video */}
          {id && transcript && transcript.length > 0 && (
            <AISummary videoId={id} videoTitle={videoData.title} transcript={transcript} onSummaryLoaded={setSummary} />
          )}
          
          {/* Debug info */}
          <div style={{ margin: '10px 0', padding: '10px', background: '#f0f0f0', borderRadius: '5px' }}>
            <div><strong>Debug Info:</strong></div>
            <div>Current Timestamp: {currentTimestamp ? `${currentTimestamp.toFixed(2)}s` : 'None'}</div>
            <div>Video ID: {id || 'Loading...'}</div>
            <div>Transcript Segments: {transcript?.length || 0}</div>
          </div>

          {mode === 'learn' && (
            <div className={styles.learningSection}>
              <div className={styles.summary}>
                <h3>Video Summary</h3>
                <p>
                  This video covers the fundamentals of JavaScript programming language,
                  including variables, data types, and basic functions. It provides clear
                  examples and practical demonstrations of core concepts for beginners.
                </p>
              </div>
            </div>
          )}

          {mode === 'quiz' && (
            <div className={styles.quizSection}>
              <h2>Test Your Knowledge</h2>
              {quizQuestions.map(question => (
                <div key={question.id} className={styles.questionCard}>
                  <h3>{question.question}</h3>
                  <div className={styles.options}>
                    {question.options.map((option, index) => (
                      <label key={index} className={styles.option}>
                        <input 
                          type="radio" 
                          name={`question-${question.id}`} 
                          value={option} 
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <button className={styles.submitButton}>Check Answers</button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}