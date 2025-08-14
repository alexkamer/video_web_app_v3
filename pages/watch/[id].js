import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import styles from '../../styles/Watch.module.css';
import Logo from '../../components/Logo';
import SearchBar from '../../components/SearchBar';
import TranscriptViewer from '../../components/TranscriptViewer';
import AISummary from '../../components/AISummary';
import YouTubePlayer from '../../components/YouTubePlayer';
import DownloadModal from '../../components/DownloadModal';
import VideoQuiz from '../../components/VideoQuiz';
import YouTubeEmbedPlayer from '../../components/YouTubeEmbedPlayer';
import VideoChat from '../../components/VideoChat';

export default function WatchPage() {
  const router = useRouter();
  const { id, mode: initialMode } = router.query;
  const [mode, setMode] = useState('watch'); // 'watch', 'learn', or 'quiz'
  const [videoDetails, setVideoDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showMoreButton, setShowMoreButton] = useState(false);
  const [isTranscriptVisible, setIsTranscriptVisible] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [playerReady, setPlayerReady] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [nextQuestionTimestamp, setNextQuestionTimestamp] = useState(null);
  const playerRef = useRef(null);
  const [summary, setSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryLoaded, setSummaryLoaded] = useState(false);
  const descriptionRef = useRef(null);

  // Utility function to convert URLs and timestamps to clickable links
  const parseLinksAndTimestamps = (text) => {
    if (!text) return text;
    
    // First, parse URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    let parts = text.split(urlRegex);
    
    // Process each part for URLs
    parts = parts.map((part, index) => {
      if (urlRegex.test(part)) {
        return (
          <a 
            key={`url-${index}`}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.externalLink}
          >
            {part}
          </a>
        );
      }
      return part;
    });
    
    // Then, parse timestamps in each part
    const timestampRegex = /(\d{1,2}):(\d{2})(?::(\d{2}))?/g;
    
    return parts.map((part, partIndex) => {
      if (typeof part === 'string') {
        // Use a different approach to avoid undefined parts from split with capture groups
        const timestampMatches = [...part.matchAll(timestampRegex)];
        
        if (timestampMatches.length === 0) {
          return part; // No timestamps found, return as-is
        }
        
        // Split the text around timestamps and preserve the original text
        let result = [];
        let lastIndex = 0;
        
        timestampMatches.forEach((match, matchIndex) => {
          const matchStart = match.index;
          const matchText = match[0];
          
          // Add text before the timestamp
          if (matchStart > lastIndex) {
            result.push(part.substring(lastIndex, matchStart));
          }
          
          // Parse the timestamp
          let hours = 0;
          let minutes = 0;
          let seconds = 0;
          
          if (match[3] !== undefined) { // HH:MM:SS format
            hours = parseInt(match[1]) || 0;
            minutes = parseInt(match[2]) || 0;
            seconds = parseInt(match[3]) || 0;
          } else { // MM:SS format
            minutes = parseInt(match[1]) || 0;
            seconds = parseInt(match[2]) || 0;
          }
          
          const totalSeconds = hours * 3600 + minutes * 60 + seconds;
          
          // Add the clickable timestamp
          result.push(
            <a
              key={`timestamp-${partIndex}-${matchIndex}`}
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
                  console.log(`WatchPage: Seeking to timestamp ${matchText} (${totalSeconds}s)`);
                  playerRef.current.seekTo(totalSeconds, true);
                } else {
                  console.warn('WatchPage: Player not ready or seekTo not available');
                }
              }}
              className={styles.timestampLink}
              title={`Jump to ${matchText}`}
            >
              {matchText}
            </a>
          );
          
          lastIndex = matchStart + matchText.length;
        });
        
        // Add any remaining text after the last timestamp
        if (lastIndex < part.length) {
          result.push(part.substring(lastIndex));
        }
        
        return result;
      }
      return part;
    });
  };

  // Handle search
  const handleSearch = (searchQuery) => {
    if (searchQuery.trim()) {
      const trimmedQuery = searchQuery.trim();
              const searchUrl = `/results?search_query=${encodeURIComponent(trimmedQuery)}&content_type=all&duration=any&caption=any&quality=any&uploadDate=any&sortOrder=relevance`;
      router.push(searchUrl);
    }
  };

  // Handle transcript segment clicks
  const handleTranscriptClick = (segment) => {
    if (!segment || !segment.start || !playerRef.current) return;
    
    console.log(`WatchPage: Transcript segment clicked at ${segment.start}s`);
    
    try {
      if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
        console.log(`WatchPage: Seeking to ${segment.start} seconds`);
        playerRef.current.seekTo(segment.start, true); // true = allowSeekAhead
      } else {
        console.warn('WatchPage: Player not ready or seekTo not available');
      }
    } catch (error) {
      console.error('Error seeking to timestamp:', error);
    }
  };

  // Update mode when the URL changes
  useEffect(() => {
    if (initialMode && ['watch', 'learn', 'quiz'].includes(initialMode)) {
      setMode(initialMode);
    }
  }, [initialMode]);

  // Handle summary loading state and auto-switch to watch mode
  const handleSummaryLoaded = (summaryData) => {
    setSummary(summaryData);
    setSummaryLoading(false);
    setSummaryLoaded(true);
    
    // If user was on learn or quiz mode but summary wasn't loaded, switch to watch
    if (mode !== 'watch') {
      setMode('watch');
      router.push(`/watch/${id}?mode=watch`, undefined, { shallow: true });
    }
  };

  const handleSummaryLoading = (isLoading) => {
    setSummaryLoading(isLoading);
    
    // If summary is loading and user is not on watch mode, switch to watch
    if (isLoading && mode !== 'watch') {
      setMode('watch');
      router.push(`/watch/${id}?mode=watch`, undefined, { shallow: true });
    }
  };

  // Set current video ID globally for player access
  useEffect(() => {
    if (typeof window !== 'undefined' && id) {
      window.currentVideoId = id;
    }
  }, [id]);



  // Track user activity for smart caching
  useEffect(() => {
    if (!id) return;

    // Mark user as active when they enter the watch page
    const markActive = async () => {
      try {
        await fetch('/api/youtube/mark-active', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId: id })
        });
      } catch (error) {
        console.error('Failed to mark user active:', error);
      }
    };

    markActive();

    // Mark user as inactive when they leave the page
    const handleBeforeUnload = () => {
      fetch('/api/youtube/mark-inactive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: id })
      }).catch(() => {}); // Ignore errors on page unload
    };

    // Mark user as inactive when they navigate away
    const handleRouteChange = () => {
      fetch('/api/youtube/mark-inactive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: id })
      }).catch(() => {}); // Ignore errors on route change
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    router.events.on('routeChangeStart', handleRouteChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      router.events.off('routeChangeStart', handleRouteChange);
      
      // Mark user as inactive when component unmounts
      fetch('/api/youtube/mark-inactive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: id })
      }).catch(() => {}); // Ignore errors on unmount
    };
  }, [id, router]);

  useEffect(() => {
    if (!id) return;

    async function fetchVideoDetails() {
      try {
        const response = await fetch(`/api/youtube/video/${id}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch video details');
        }
        
        const data = await response.json();
        setVideoDetails(data.items && data.items[0] ? data.items[0] : null);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching video:', err);
        setError('Failed to load video details. Please try again.');
        setLoading(false);
      }
    }

    fetchVideoDetails();
  }, [id]);
  
  // Initialize YouTube iframe API
  // The player initialization is now handled by the YouTubePlayer component
  // This keeps the code clean and ensures consistent player behavior
  
  // Check if description needs a "Show more" button
  useEffect(() => {
    if (!videoDetails || !descriptionRef.current) return;
    
    // If the description is long enough, show the toggle button
    const description = videoDetails.snippet.description;
    
    // Check if description is long enough to need expansion
    // Either by character count or if there are multiple paragraphs
    const isLongDescription = description.length > 300 || description.split('\n').length > 3;
    
    setShowMoreButton(isLongDescription);
  }, [videoDetails]);

  if (loading) {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <Logo />
        </header>
        <div className={styles.loading}>Loading video...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <Logo />
        </header>
        <div className={styles.error}>{error}</div>
        <Link href="/" className={styles.backButton}>
          Back to Search
        </Link>
      </div>
    );
  }

  const videoTitle = videoDetails?.snippet?.title || 'Video';
  
  return (
    <div className={styles.container}>
      <Head>
        <title>{videoTitle} | Video Learning</title>
        <meta name="description" content={videoDetails?.snippet?.description || 'Watch this video'} />
      </Head>
      
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <Logo />
          <div className={styles.searchContainer}>
            <SearchBar onSearch={handleSearch} placeholder="Search for videos..." />
          </div>
        </div>
      </header>
      
      <main className={styles.main}>
        <div className={styles.mainContentContainer}>
          <div className={styles.videoContainer}>
            {id && (
              <div className={styles.videoPlayerWrapper}>
                <YouTubeEmbedPlayer
                  ref={playerRef}
                  videoId={id}
                  onTimeUpdate={setCurrentTime}
                  onPause={() => console.log('Video paused')}
                  onResume={() => console.log('Video resumed')}
                />
                
                {/* Quiz overlay */}
                {mode === 'quiz' && (
                  <VideoQuiz
                    videoId={id}
                    transcript={transcript}
                    summary={summary}
                    currentTime={currentTime}
                    isActive={mode === 'quiz'}
                    config={{
                      difficulty: 'medium',
                      questionCount: 5,
                      includeExplanations: true
                    }}
                    playerRef={playerRef}
                    onQuizComplete={(result) => {
                      console.log('Quiz completed with score:', result.score);
                    }}
                    onPauseVideo={() => playerRef.current && playerRef.current.pause()}
                    onResumeVideo={() => playerRef.current && playerRef.current.play()}
                    onSeek={(timestamp) => playerRef.current && playerRef.current.seekTo(timestamp)}
                  />
                )}
              </div>
            )}
          </div>
        
          {/* Transcript panel on the right side */}
          <div className={`${styles.transcriptPanel} ${!isTranscriptVisible ? styles.collapsed : ''}`}>
            <TranscriptViewer 
              videoId={id} 
              onTranscriptLoaded={(transcriptData) => setTranscript(transcriptData)}
              onSegmentClick={handleTranscriptClick}
            />
          </div>
        </div>
        
        {videoDetails && (
          <div className={styles.videoInfo}>
            <h1 className={styles.title}>{videoDetails.snippet.title}</h1>
            
            <div className={styles.meta}>
              <div className={styles.channel}>
                {videoDetails.snippet.channelTitle}
              </div>
              
              {videoDetails.statistics && (
                <div className={styles.stats}>
                  <span className={styles.views}>
                    {parseInt(videoDetails.statistics.viewCount).toLocaleString()} views
                  </span>
                  
                  {videoDetails.statistics.likeCount && (
                    <span className={styles.likes}>
                      {parseInt(videoDetails.statistics.likeCount).toLocaleString()} likes
                    </span>
                  )}
                </div>
              )}
            </div>
            
            <div className={styles.actionButtons}>
              <button 
                className={`${styles.actionButton} ${styles.downloadButton}`}
                onClick={() => setShowDownloadModal(true)}
              >
                Download Video
              </button>
              
              <button
                className={`${styles.actionButton} ${styles.transcriptButton}`}
                onClick={() => setIsTranscriptVisible(!isTranscriptVisible)}
              >
                {isTranscriptVisible ? 'Hide Transcript' : 'Show Transcript'}
              </button>
              
              <div className={styles.modeButtonsContainer}>
                <button 
                  className={`${styles.modeButton} ${mode === 'watch' ? styles.active : ''}`}
                  onClick={() => {
                    setMode('watch');
                    router.push(`/watch/${id}?mode=watch`, undefined, { shallow: true });
                  }}
                >
                  <span>👁️ Watch Mode</span>
                  {summaryLoading && mode === 'watch' && (
                    <span className={styles.loadingIndicator}>⏳</span>
                  )}
                </button>
                <button 
                  className={`${styles.modeButton} ${mode === 'learn' ? styles.active : ''} ${summaryLoading ? styles.disabled : ''}`}
                  onClick={() => {
                    if (!summaryLoading) {
                      setMode('learn');
                      router.push(`/watch/${id}?mode=learn`, undefined, { shallow: true });
                    }
                  }}
                  disabled={summaryLoading}
                >
                  <span>📚 Learn Mode</span>
                  {summaryLoading && (
                    <span className={styles.disabledReason}>Waiting for AI Summary...</span>
                  )}
                </button>
                <button 
                  className={`${styles.modeButton} ${mode === 'quiz' ? styles.active : ''} ${!summaryLoaded ? styles.disabled : ''}`}
                  onClick={() => {
                    if (summaryLoaded) {
                      setMode('quiz');
                      router.push(`/watch/${id}?mode=quiz`, undefined, { shallow: true });
                    }
                  }}
                  disabled={!summaryLoaded}
                >
                  <span>✅ Quiz Mode</span>
                  {!summaryLoaded && (
                    <span className={styles.disabledReason}>Waiting for AI Summary...</span>
                  )}
                </button>
              </div>
            </div>
            
            <div 
              className={`${styles.description} ${isExpanded ? styles.expanded : styles.collapsed}`}
              ref={descriptionRef}
            >
              <h3 className={styles.descriptionTitle}>Description</h3>
              <div className={styles.descriptionContent}>
                {videoDetails.snippet.description.split('\n').map((line, i) => (
                  <p key={i}>{parseLinksAndTimestamps(line)}</p>
                ))}
              </div>
              
              {showMoreButton && (
                <button 
                  className={styles.toggleButton}
                  onClick={() => setIsExpanded(!isExpanded)}
                >
                  {isExpanded ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>
          </div>
        )}
        
        {/* AI Summary section - between description and transcript */}
        {/* Display appropriate content based on mode */}
        {mode === 'watch' && (
          <div className={styles.summarySection}>
            <AISummary 
              videoId={id} 
              videoTitle={videoDetails?.snippet?.title || ''}
              transcript={transcript}
              onSummaryLoaded={handleSummaryLoaded}
              onLoadingChange={handleSummaryLoading}
              existingSummary={summary}
            />
          </div>
        )}
        
        {mode === 'learn' && (
          <div className={styles.learningSection}>
            <div className={styles.learningContent}>
              <div className={styles.summary}>
                <h3>Video Summary</h3>
                <AISummary 
                  videoId={id} 
                  videoTitle={videoDetails?.snippet?.title || ''}
                  transcript={transcript}
                  onSummaryLoaded={handleSummaryLoaded}
                  onLoadingChange={handleSummaryLoading}
                  onNextQuestion={setNextQuestionTimestamp}
                  existingSummary={summary}
                />
              </div>
              
              <div className={styles.chatSection}>
                <VideoChat
                  videoId={id}
                  videoTitle={videoDetails?.snippet?.title || ''}
                  summary={summary}
                  transcript={transcript}
                  currentTime={currentTime}
                />
              </div>
            </div>
          </div>
        )}
        
        {mode === 'quiz' && (
          <div className={styles.quizSection}>
            <h2>Test Your Knowledge</h2>
            <div className={styles.quizInfoCard}>
              <div className={styles.quizInfoHeader}>
                <span className={styles.quizIcon}>✏️</span>
                <h3>Interactive Video Quiz</h3>
              </div>
              
              <div className={styles.quizInfoContent}>
                <p>Answer questions about this video to test your understanding. Questions will appear at key points as you watch.</p>
                
                <div className={styles.quizFeatures}>
                  <div className={styles.quizFeature}>
                    <span className={styles.featureIcon}>🎯</span>
                    <span>Customizable difficulty levels</span>
                  </div>
                  <div className={styles.quizFeature}>
                    <span className={styles.featureIcon}>💡</span>
                    <span>Explanations for each answer</span>
                  </div>
                  <div className={styles.quizFeature}>
                    <span className={styles.featureIcon}>📊</span>
                    <span>Performance tracking</span>
                  </div>
                </div>
                
                <div className={styles.quizInstructions}>
                  <h4>How it works:</h4>
                  <ol>
                    <li>Click on the video to begin playback</li>
                    <li>Configure your quiz settings when prompted</li>
                    <li>The video will pause at key moments for quiz questions</li>
                    <li>Answer questions and learn from explanations</li>
                    <li>See your final score at the end</li>
                  </ol>
                </div>
              </div>
              
              <div className={styles.quizPrompt}>
                <p>Ready to begin? Start playing the video to take the quiz!</p>
              </div>
            </div>
          </div>
        )}
        
        {/* No transcript section here - moved to side panel */}
        
        <Link href="/results" className={styles.backButton}>
          Back to Results
        </Link>
      </main>
      
      {/* Download Modal */}
      <DownloadModal 
        isOpen={showDownloadModal} 
        onClose={() => setShowDownloadModal(false)} 
        videoId={id} 
        videoTitle={videoDetails?.snippet?.title || ''}
      />
    </div>
  );
}
