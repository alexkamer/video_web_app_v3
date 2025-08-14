// Force Play - YouTube playback continuation helper
// This script ensures YouTube video playback continues when navigating timestamps

// Store YouTube player reference
let youtubePlayer = null;
let playbackInterval = null;
let wasPlayingBeforeSeek = true;

// Set up a global observer to monitor iframe state changes
const setupPlaybackObserver = () => {
  // Clear any existing interval
  if (playbackInterval) {
    clearInterval(playbackInterval);
  }
  
  // Check and force play every 100ms for 2 seconds after a seek
  playbackInterval = setInterval(() => {
    if (!youtubePlayer) return;
    
    try {
      // Force playback if player exists and is not playing
      if (typeof youtubePlayer.getPlayerState === 'function' && 
          youtubePlayer.getPlayerState() !== 1) { // 1 = playing
        console.log('Force-play: Detected paused state, forcing playback');
        youtubePlayer.playVideo();
      }
    } catch (e) {
      console.error('Force-play: Error during interval check', e);
    }
  }, 100);
  
  // Stop checking after 2 seconds
  setTimeout(() => {
    if (playbackInterval) {
      clearInterval(playbackInterval);
      playbackInterval = null;
    }
  }, 2000);
};

// Enhanced seekTo function that preserves playback
const enhancedSeekTo = (seconds, allowSeekAhead = true) => {
  if (!youtubePlayer || typeof youtubePlayer.seekTo !== 'function') {
    console.error('Force-play: No player available for seeking');
    return false;
  }
  
  try {
    console.log(`Force-play: Seeking to ${seconds}s with playback preservation`);
    
    // Always assume the video was playing for better UX
    wasPlayingBeforeSeek = true;
    
    // Set a flag for aggressive play forcing
    window._forcePlayActive = true;
    
    // Get current state of iframe
    const currentSrc = youtubePlayer.getIframe().src;
    
    // Approach 1: Try direct iframe URL replacement first (like initial load)
    try {
      // Create a new src with the timestamp parameter and autoplay
      const videoId = youtubePlayer.getVideoData().video_id;
      if (videoId) {
        const iframe = youtubePlayer.getIframe();
        const newSrc = `https://www.youtube.com/embed/${videoId}?autoplay=1&start=${Math.floor(seconds)}&enablejsapi=1`;
        console.log(`Force-play: Setting iframe src to: ${newSrc}`);
        iframe.src = newSrc;
        
        // Exit early - the iframe will reload with autoplay
        return true;
      }
    } catch (innerErr) {
      console.error('Force-play: Error with direct iframe approach, trying API method', innerErr);
    }
    
    // Approach 2: API method if iframe manipulation failed
    // First call seekTo
    youtubePlayer.seekTo(seconds, allowSeekAhead);
    
    // Immediately try to play
    youtubePlayer.playVideo();
    
    // Set up interval to ensure playback continues
    setupPlaybackObserver();
    
    // Additional attempts with delays
    for (let delay of [50, 100, 200, 500, 1000, 1500]) {
      setTimeout(() => {
        if (!youtubePlayer) return;
        try {
          // Only force play if not already playing
          if (typeof youtubePlayer.getPlayerState === 'function' && 
              youtubePlayer.getPlayerState() !== 1) {
            console.log(`Force-play: Additional play attempt at ${delay}ms`);
            youtubePlayer.playVideo();
          }
        } catch (e) {
          console.error(`Force-play: Error during delayed play at ${delay}ms`, e);
        }
      }, delay);
    }
    
    // Clear force play flag after 2 seconds
    setTimeout(() => {
      window._forcePlayActive = false;
    }, 2000);
    
    return true;
  } catch (e) {
    console.error('Force-play: Error during enhanced seek operation', e);
    return false;
  }
};

// Set up event listener for messages from iframe
window.addEventListener('message', (event) => {
  // Process YouTube API messages
  if (typeof event.data === 'string' && event.data.indexOf('{"event":"') === 0) {
    try {
      const data = JSON.parse(event.data);
      
      // Handle player state changes
      if (data.event === 'onStateChange') {
        // State = 2 means paused
        if (data.info === 2 && window._forcePlayActive) {
          console.log('Force-play: Detected pause event during force-play window, countering');
          if (youtubePlayer && typeof youtubePlayer.playVideo === 'function') {
            setTimeout(() => youtubePlayer.playVideo(), 10);
          }
        }
      }
    } catch (e) {
      // Ignore parsing errors
    }
  }
});

// Export functions for global use
window.initForcePlay = (player) => {
  youtubePlayer = player;
  console.log('Force-play: Initialized with player', player);
};

window.forcePlaySeekTo = enhancedSeekTo;