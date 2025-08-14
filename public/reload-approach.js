// Reload Approach - Use browser history/URL navigation for timestamp changes
// This simulates the same process as a page refresh but preserves the timestamp

// Store reference to current video ID and timestamp
let currentVideoId = null;
let autoplayRequested = false;

// Set up timestamp navigation that works like a page refresh
window.navigateToTimestamp = (videoId, timestamp) => {
  if (!videoId) return false;
  
  try {
    console.log(`Navigating to timestamp ${timestamp}s using URL/reload approach`);
    
    // Mark that we're intentionally navigating
    autoplayRequested = true;
    
    // Store current video ID
    currentVideoId = videoId;
    
    // Create URL with query parameters
    const url = new URL(window.location.href);
    
    // Update or add the timestamp parameter
    url.searchParams.set('t', Math.floor(timestamp));
    
    // Force reload behavior
    url.searchParams.set('autoplay', '1');
    
    // Add a cache buster to ensure the page treats this as a fresh load
    url.searchParams.set('_ts', Date.now());
    
    // Use history API to update URL without full page reload
    window.history.replaceState({}, '', url.toString());
    
    // Create a completely new iframe for guaranteed autoplay behavior
    const playerContainer = document.querySelector('.videoPlayer') || 
                          document.querySelector('[class*="videoPlayer"]');
    
    if (playerContainer) {
      // Create a brand new iframe
      const newIframe = document.createElement('iframe');
      newIframe.id = 'youtube-player';
      newIframe.width = '560';
      newIframe.height = '315';
      newIframe.style.position = 'absolute';
      newIframe.style.top = '0';
      newIframe.style.left = '0';
      newIframe.style.width = '100%';
      newIframe.style.height = '100%';
      newIframe.frameBorder = '0';
      newIframe.title = 'YouTube video player';
      newIframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      newIframe.allowFullscreen = true;
      
      // Use the same URL format as initial page load for consistent behavior
      newIframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&start=${Math.floor(timestamp)}&enablejsapi=1&modestbranding=1&rel=0&playsinline=1`;
      
      // Find and replace existing iframe
      const existingIframe = document.getElementById('youtube-player') || 
                          playerContainer.querySelector('iframe');
      
      if (existingIframe) {
        console.log('Replacing existing iframe for guaranteed autoplay');
        existingIframe.parentNode.replaceChild(newIframe, existingIframe);
      } else {
        console.log('Adding new iframe to container');
        playerContainer.innerHTML = '';
        playerContainer.appendChild(newIframe);
      }
      
      // Set timeout to unmute after autoplay starts
      setTimeout(() => {
        try {
          // Use postMessage to unmute
          newIframe.contentWindow.postMessage('{"event":"command","func":"unMute","args":[]}', '*');
        } catch (e) {}
      }, 1000);
      
      return true;
    } else {
      // If container doesn't exist, reload page
      window.location.reload();
      return true;
    }
  } catch (e) {
    console.error('Error navigating to timestamp:', e);
    return false;
  }
};

// Check URL parameters on page load
window.addEventListener('DOMContentLoaded', () => {
  const url = new URL(window.location.href);
  const t = url.searchParams.get('t');
  
  // If we have a timestamp parameter, it means we came from a timestamp link
  if (t) {
    console.log(`Found timestamp parameter in URL: ${t}s, ensuring autoplay`);
    
    // Make sure autoplay is set
    autoplayRequested = true;
    
    // Find the iframe and ensure autoplay is set
    setTimeout(() => {
      const iframe = document.getElementById('youtube-player');
      if (iframe && !iframe.src.includes('autoplay=1')) {
        const currentSrc = iframe.src;
        const newSrc = currentSrc.includes('?') 
          ? currentSrc + '&autoplay=1' 
          : currentSrc + '?autoplay=1';
        
        console.log(`Setting autoplay in iframe src: ${newSrc}`);
        iframe.src = newSrc;
      }
    }, 100);
  }
});