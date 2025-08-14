import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import styles from '../styles/YouTubeEmbedPlayer.module.css';

const YouTubeEmbedPlayer = forwardRef(({ videoId, startTime, onTimeUpdate, onPause, onResume }, ref) => {
  // Component display name for React DevTools
  YouTubeEmbedPlayer.displayName = 'YouTubeEmbedPlayer';
  const playerRef = useRef(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);

  useImperativeHandle(ref, () => ({
    play: () => {
      if (playerRef.current) {
        playerRef.current.playVideo();
      }
    },
    pause: () => {
      if (playerRef.current) {
        playerRef.current.pauseVideo();
      }
    },
    seekTo: (time) => {
      console.log(`YouTubePlayer: Seeking to ${time} seconds`);
      
      const attemptSeek = (retryCount = 0) => {
        if (!playerRef.current) {
          console.warn('YouTubePlayer: Player ref not available');
          if (retryCount < 10) {
            setTimeout(() => attemptSeek(retryCount + 1), 100);
          }
          return;
        }
        
        try {
          const playerState = playerRef.current.getPlayerState();
          const videoData = playerRef.current.getVideoData();
          
          console.log(`YouTubePlayer: Player state: ${playerState}, Video data:`, videoData);
          
          // Check if player is ready and has a video loaded
          const isReady = videoData && 
                         videoData.video_id && 
                         typeof playerRef.current.seekTo === 'function' &&
                         playerState !== -1; // -1 means unstarted
          
          if (isReady) {
            // Player is ready, use seekTo
            console.log('YouTubePlayer: Using seekTo method');
            playerRef.current.seekTo(time, true);
            return true;
          } else {
            // Player not ready, use loadVideoById
            console.log('YouTubePlayer: Player not ready, using loadVideoById');
            if (typeof playerRef.current.loadVideoById === 'function') {
              const targetVideoId = videoData?.video_id || window.currentVideoId;
              console.log(`YouTubePlayer: Loading video ${targetVideoId} at ${time}s`);
              playerRef.current.loadVideoById({
                videoId: targetVideoId,
                startSeconds: time
              });
              return true;
            }
          }
          
          // If we get here, neither method worked
          if (retryCount < 10) {
            console.log(`YouTubePlayer: Retry attempt ${retryCount + 1}/10`);
            setTimeout(() => attemptSeek(retryCount + 1), 100);
          } else {
            console.error('YouTubePlayer: All seek attempts failed');
          }
        } catch (error) {
          console.error('YouTubePlayer: Error during seek attempt:', error);
          if (retryCount < 10) {
            console.log(`YouTubePlayer: Retry attempt ${retryCount + 1}/10 after error`);
            setTimeout(() => attemptSeek(retryCount + 1), 100);
          }
        }
      };
      
      attemptSeek();
    },
  }));

  useEffect(() => {
    const loadYouTubeAPI = () => {
      if (window.YT && typeof window.YT.Player === 'function') {
        initializePlayer();
      } else {
        if (!document.getElementById('youtube-api-script')) {
          const tag = document.createElement('script');
          tag.id = 'youtube-api-script';
          tag.src = 'https://www.youtube.com/iframe_api';
          const firstScriptTag = document.getElementsByTagName('script')[0];
          firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        }
        window.onYouTubeIframeAPIReady = () => {
          initializePlayer();
        };
      }
    };

    loadYouTubeAPI();

    return () => {
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        playerRef.current.destroy();
      }
    };
  }, []);

  // Removed the loadVideoById effect that was causing video reloads
  // The video is loaded once during initialization and should not be reloaded

  const initializePlayer = () => {
    if (playerRef.current) {
      playerRef.current.destroy();
    }

    playerRef.current = new window.YT.Player('youtube-player-container', {
      videoId,
      playerVars: {
        autoplay: 0, // Don't autoplay to avoid conflicts with seeking
        controls: 1,
        rel: 0,
        modestbranding: 1,
        start: startTime || 0,
        playsinline: 1,
      },
      events: {
        onReady: onPlayerReady,
        onStateChange: onPlayerStateChange,
      },
    });
  };

  const onPlayerReady = (event) => {
    setIsPlayerReady(true);
    // Don't auto-play immediately to avoid conflicts with seeking
    console.log('YouTubePlayer: Player ready');
    
    // Ensure the player is fully loaded by checking after a short delay
    setTimeout(() => {
      if (playerRef.current) {
        const videoData = playerRef.current.getVideoData();
        console.log('YouTubePlayer: Player fully loaded, video data:', videoData);
      }
    }, 1000);
  };

  const onPlayerStateChange = (event) => {
    console.log(`YouTubePlayer: State change to ${event.data}`);
    
    if (event.data === window.YT.PlayerState.PLAYING) {
      if (onResume) onResume();
      // Set up an interval to update the time
      const timeUpdateInterval = setInterval(() => {
        if (playerRef.current) {
          const currentTime = playerRef.current.getCurrentTime();
          if (onTimeUpdate) {
            onTimeUpdate(currentTime);
          }
        }
      }, 250);
      // Store the interval ID to clear it later
      playerRef.current.timeUpdateInterval = timeUpdateInterval;
    } else if (event.data === window.YT.PlayerState.PAUSED) {
      if (onPause) onPause();
      // Clear the interval when the video is paused
      if (playerRef.current && playerRef.current.timeUpdateInterval) {
        clearInterval(playerRef.current.timeUpdateInterval);
      }
    } else if (event.data === window.YT.PlayerState.ENDED) {
      // Clear the interval when the video ends
      if (playerRef.current && playerRef.current.timeUpdateInterval) {
        clearInterval(playerRef.current.timeUpdateInterval);
      }
    }
  };

  return (
    <div className={styles.container}>
      <div id="youtube-player-container" className={styles.playerContainer}></div>
    </div>
  );
});

export default YouTubeEmbedPlayer;