import { useState, useEffect, useMemo, useRef } from 'react';
import styles from '../styles/TranscriptViewer.module.css';

export default function SimpleTranscriptViewer({ videoId, onTranscriptLoaded, onSegmentClick }) {
  const [isCollapsed, setIsCollapsed] = useState(false); // Start expanded when in side panel
  const [transcript, setTranscript] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentSegment, setCurrentSegment] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const transcriptContentRef = useRef(null);
  const [userScrolling, setUserScrolling] = useState(false);
  const userScrollTimeout = useRef(null);
  
  // Get the current video ID from window or props
  const currentVideoId = useMemo(() => window?.currentVideoId || videoId, [videoId]);
  
  // Process transcript: filter out timestamp-only lines and group segments
  const processedTranscript = useMemo(() => {
    if (!transcript || transcript.length === 0) return [];
    
    // First, filter out timestamp-only lines and empty lines
    const filtered = transcript.filter(segment => {
      // Regular expression patterns for timestamps
      const timeStampPatterns = [
        /^\d{1,2}:\d{2}$/,                     // 1:23
        /^\d{1,2}:\d{2}:\d{2}$/,               // 1:23:45
        /^\[\d{1,2}:\d{2}\]$/,                 // [1:23]
        /^\[\d{1,2}:\d{2}:\d{2}\]$/,           // [1:23:45]
        /^\(\d{1,2}:\d{2}\)$/,                 // (1:23)
        /^\(\d{1,2}:\d{2}:\d{2}\)$/            // (1:23:45)
      ];
      
      // Check if text is empty or contains only timestamps
      const text = segment.text.trim();
      if (!text) return false;
      
      // Check if text only contains a timestamp pattern
      return !timeStampPatterns.some(pattern => pattern.test(text));
    });
    
    // Group adjacent segments and remove duplicates
    const grouped = [];
    let currentGroup = null;
    let lastUniqueText = "";
    
    filtered.forEach((segment, i) => {
      // Clean the segment text - remove HTML tags and timestamps
      let currentText = cleanTranscriptText(segment.text);
      
      // Further trim for processing
      currentText = currentText.trim();
      
      // Skip if this segment text is a duplicate of the previous one
      // or if it's completely contained within the previous text
      if (currentText === lastUniqueText || 
          (lastUniqueText.length > 0 && lastUniqueText.includes(currentText))) {
        // Just update the duration if needed
        if (currentGroup) {
          currentGroup.duration = Math.max(
            currentGroup.duration,
            (segment.start + segment.duration) - currentGroup.start
          );
        }
        return; // Skip this segment
      }
      
      // If this is the first segment or the gap between segments is large
      // (> 2 seconds), start a new group
      if (!currentGroup || 
          (i > 0 && segment.start - (filtered[i-1].start + filtered[i-1].duration) > 2) ||
          // Or if this segment doesn't overlap with the previous one in terms of content
          !hasSignificantOverlap(currentText, lastUniqueText)) {
        
        // Finish previous group if it exists
        if (currentGroup) {
          grouped.push(currentGroup);
        }
        
        // Start new group
        currentGroup = {
          ...segment,
          text: currentText,
          segments: [segment]
        };
        
        lastUniqueText = currentText;
      } else {
        // Check if this segment adds new information to the current group
        const combinedText = smartCombine(currentGroup.text, currentText);
        
        if (combinedText !== currentGroup.text) {
          // Add to current group only if it adds new information
          currentGroup.duration = (segment.start + segment.duration) - currentGroup.start;
          currentGroup.text = combinedText;
          currentGroup.segments.push(segment);
          lastUniqueText = combinedText;
        }
      }
    });
    
    // Add the last group if it exists
    if (currentGroup) {
      grouped.push(currentGroup);
    }
    
    return grouped;
  }, [transcript]);

  // Helper function to detect significant content overlap
  function hasSignificantOverlap(text1, text2) {
    if (!text1 || !text2) return false;
    if (text1 === text2) return true;
    
    // Get the longer and shorter texts
    const [longer, shorter] = text1.length >= text2.length 
      ? [text1.toLowerCase(), text2.toLowerCase()]
      : [text2.toLowerCase(), text1.toLowerCase()];
      
    // Check if shorter text is substantially contained in longer text
    // This helps with repeated phrases that are part of the same thought
    return longer.includes(shorter) || 
           levenshteinDistance(longer, shorter) / longer.length < 0.3;
  }
  
  // Smart combine function that avoids repetition
  function smartCombine(existingText, newText) {
    if (existingText.includes(newText)) {
      return existingText;
    }
    
    if (newText.includes(existingText)) {
      return newText;
    }
    
    // Try to find the best join point to avoid repetition
    let bestOverlap = 0;
    let overlapPos = 0;
    
    // Check for overlapping ends/beginnings
    for (let i = 1; i < Math.min(existingText.length, newText.length); i++) {
      if (existingText.slice(-i) === newText.slice(0, i)) {
        if (i > bestOverlap) {
          bestOverlap = i;
          overlapPos = i;
        }
      }
    }
    
    if (bestOverlap > 3) {  // Only join if significant overlap
      return existingText + newText.slice(overlapPos);
    }
    
    // Default case: just append with space
    return `${existingText} ${newText}`;
  }
  
  // Simple Levenshtein distance for string similarity
  function levenshteinDistance(str1, str2) {
    const track = Array(str2.length + 1).fill(null).map(() => 
      Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i += 1) {
      track[0][i] = i;
    }
    
    for (let j = 0; j <= str2.length; j += 1) {
      track[j][0] = j;
    }
    
    for (let j = 1; j <= str2.length; j += 1) {
      for (let i = 1; i <= str1.length; i += 1) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        track[j][i] = Math.min(
          track[j][i - 1] + 1, // deletion
          track[j - 1][i] + 1, // insertion
          track[j - 1][i - 1] + indicator, // substitution
        );
      }
    }
    
    return track[str2.length][str1.length];
  }
  
  // Fetch transcript when videoId changes
  useEffect(() => {
    if (!videoId || typeof videoId !== 'string' || videoId.trim() === '') return;
    
    async function fetchTranscript() {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/youtube/transcript/${videoId}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to fetch transcript');
        }
        
        const data = await response.json();
        
        if (data.success && data.transcript) {
          // Store the raw transcript data
          setTranscript(data.transcript);
          
          // Send transcript data to parent component if callback provided
          if (typeof onTranscriptLoaded === 'function') {
            onTranscriptLoaded(data.transcript);
          }
        } else {
          throw new Error('Invalid transcript data received');
        }
      } catch (err) {
        console.error('Error fetching transcript:', err);
        setError(err.message || 'Failed to load transcript');
      } finally {
        setLoading(false);
      }
    }
    
    fetchTranscript();
  }, [videoId, onTranscriptLoaded]);
  
  // Function to handle segment click
  const handleSegmentClick = (segment) => {
    // Handle edge case if no segment
    if (!segment || typeof segment.start !== 'number') {
      console.error('Invalid segment:', segment);
      return;
    }
    
    // Update the UI to show the selected segment
    setCurrentSegment(segment);
    
    // Calculate timestamp in seconds
    const timestamp = Math.floor(segment.start);
    
    // Log the segment click for debugging
    console.log(`Transcript segment clicked at ${timestamp}s:`, segment);
    
    // Just call parent handler - we'll handle seeking in VideoPage component
    // This gives us more consistent behavior with the initial load approach
    
    // Always call parent handler if provided
    if (typeof onSegmentClick === 'function') {
      onSegmentClick(segment);
    }
  };
  
  // Add effect to track current time from YouTube player (global instance)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Add listener for custom YouTube time update events
    const handleYouTubeTimeUpdate = (event) => {
      if (event.detail && typeof event.detail.currentTime === 'number') {
        setCurrentTime(event.detail.currentTime);
      }
    };
    
    // Listen for time update events from YouTube player
    window.addEventListener('youtubeTimeUpdate', handleYouTubeTimeUpdate);
    
    // Remove event listener on cleanup
    return () => {
      window.removeEventListener('youtubeTimeUpdate', handleYouTubeTimeUpdate);
    };
    
    // Function to update current time
    const updateCurrentTime = () => {
      try {
        // Try multiple methods to get the current time
        if (window.youtubePlayer && typeof window.youtubePlayer.getCurrentTime === 'function') {
          const time = window.youtubePlayer.getCurrentTime();
          setCurrentTime(time);
          return; // Success, exit early
        }
        
        if (window.player && typeof window.player.getCurrentTime === 'function') {
          const time = window.player.getCurrentTime();
          setCurrentTime(time);
          return; // Success, exit early
        }
        
        // Look for any YouTube iframe as a last resort
        const iframe = document.querySelector('iframe[src*="youtube.com/embed"]');
        if (iframe && iframe.id) {
          // Try to find a player instance by iframe ID
          const playerId = iframe.id;
          if (window.YT && window.YT.get && typeof window.YT.get === 'function') {
            const playerInstance = window.YT.get(playerId);
            if (playerInstance && typeof playerInstance.getCurrentTime === 'function') {
              const time = playerInstance.getCurrentTime();
              setCurrentTime(time);
            }
          }
        }
      } catch (err) {
        // Silently fail if player is not ready
      }
    };
    
    // Run immediately on first render
    updateCurrentTime();
    
    // Update time every 500ms
    const interval = setInterval(updateCurrentTime, 500);
    
    return () => clearInterval(interval);
  }, []);
  
  // Set initial segment on component mount
  useEffect(() => {
    if (!processedTranscript || processedTranscript.length === 0) return;
    
    // Set the first segment as active initially
    setCurrentSegment(processedTranscript[0]);
  }, [processedTranscript]);
  
  // Effect to highlight current segment based on video time
  useEffect(() => {
    if (!processedTranscript || processedTranscript.length === 0) return; // Allow running even if currentTime is 0
    
    // Find the segment that corresponds to the current time
    let foundSegment = null;
    
    for (let i = 0; i < processedTranscript.length; i++) {
      const segment = processedTranscript[i];
      const nextSegment = processedTranscript[i + 1];
      
      // Check if current time falls within this segment
      if (currentTime >= segment.start && 
          (!nextSegment || currentTime < nextSegment.start)) {
        foundSegment = segment;
        break;
      }
    }
    
    // If we found a matching segment and it's different from the current one
    if (foundSegment && foundSegment !== currentSegment) {
      setCurrentSegment(foundSegment);
      
      // Auto-scroll to the current segment only if user isn't currently scrolling
      if (transcriptContentRef.current && !isCollapsed && !userScrolling) {
        // First try to find by data-start-time
        let segmentElement = transcriptContentRef.current.querySelector(`button[data-start-time="${foundSegment.start}"]`);
        // If not found, look for the active class
        if (!segmentElement) {
          segmentElement = transcriptContentRef.current.querySelector(`.${styles.active}`);
        }
        if (segmentElement) {
          // Use scrollIntoView only if element is out of view
          const container = transcriptContentRef.current;
          const elementTop = segmentElement.offsetTop;
          const elementBottom = elementTop + segmentElement.clientHeight;
          const containerTop = container.scrollTop;
          const containerBottom = containerTop + container.clientHeight;
          
          // Check if element is not fully visible
          if (elementTop < containerTop || elementBottom > containerBottom) {
            // Scroll only if element is not visible
            container.scrollTop = elementTop - container.clientHeight / 2;
          }
        }
      }
    }
  }, [currentTime, processedTranscript, currentSegment, isCollapsed, userScrolling]);
  
  // Render loading state
  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2>Transcript</h2>
        </div>
        <div className={styles.loading}>
          Loading transcript...
        </div>
      </div>
    );
  }
  
  // Render error state
  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2>Transcript</h2>
        </div>
        <div className={styles.error}>
          {error}
        </div>
      </div>
    );
  }
  
  // Render empty state
  if (!processedTranscript || processedTranscript.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2>Transcript</h2>
        </div>
        <div className={styles.empty}>
          No transcript available for this video.
        </div>
      </div>
    );
  }
  
  // Render transcript content
  return (
    <div className={styles.container}>
      <div className={styles.header} onClick={() => setIsCollapsed(!isCollapsed)}>
        <h2>Transcript</h2>
        <button className={styles.toggleButton}>
          {isCollapsed ? 'Show' : 'Hide'}
        </button>
      </div>
      <div 
        ref={transcriptContentRef}
        className={`${styles.transcriptContent} ${isCollapsed ? styles.collapsed : ''}`}
        onScroll={() => {
          // When user scrolls, mark as user scrolling and clear any existing timeout
          setUserScrolling(true);
          if (userScrollTimeout.current) {
            clearTimeout(userScrollTimeout.current);
          }
          
          // Reset user scrolling flag after 4 seconds of no scrolling
          userScrollTimeout.current = setTimeout(() => {
            setUserScrolling(false);
          }, 4000);
        }}>
        {processedTranscript.map((segment, index) => (
          <button
            key={index}
            className={`${styles.segment} ${currentSegment === segment ? styles.active : ''}`}
            onClick={() => handleSegmentClick(segment)}
            aria-label={`Jump to ${formatTime(segment.start)}`}
            type="button"
            data-start-time={segment.start}
          >
            <div className={styles.time}>
              {formatTime(segment.start)}
            </div>
            <div className={styles.text}>
              {cleanTranscriptText(segment.text)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// Clean transcript text of HTML tags and timestamps
function cleanTranscriptText(text) {
  if (!text) return '';
  
  // Remove HTML-style timing tags like <00:00:11.200>
  let cleaned = text.replace(/<\d{2}:\d{2}:\d{2}\.\d{3}>/g, '');
  
  // Remove style tags like <c>text</c>
  cleaned = cleaned.replace(/<\/?[a-z][^>]*>/g, '');
  
  // Remove any leftover angle brackets and their contents
  cleaned = cleaned.replace(/<[^>]*>/g, '');
  
  // Replace multiple spaces with a single space
  cleaned = cleaned.replace(/\s+/g, ' ');
  
  return cleaned.trim();
}

// Format time from seconds to MM:SS format
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}