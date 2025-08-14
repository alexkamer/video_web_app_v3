import { useState, useEffect, useMemo, useRef } from 'react';
import styles from '../styles/TranscriptViewer.module.css';

// Hook to handle transcript correction
const useTranscriptCorrection = (videoId, originalTranscript, fixedTranscript) => {
  const [useFixed, setUseFixed] = useState(true);
  
  // Debug logging
  console.log(`[useTranscriptCorrection] videoId: ${videoId}, originalTranscript: ${originalTranscript?.length || 0} segments, fixedTranscript: ${fixedTranscript?.length || 0} segments, useFixed: ${useFixed}`);
  
  // Return either fixed or original transcript based on user preference
  return { 
    transcript: useFixed && fixedTranscript ? fixedTranscript : originalTranscript,
    isFixed: useFixed && fixedTranscript ? true : false,
    toggleFixed: () => setUseFixed(!useFixed)
  };
};

// Global YouTube API variable
let YT = typeof window !== 'undefined' ? window.YT : null;

export default function TranscriptViewer({ videoId, onTranscriptLoaded, onSegmentClick }) {
  // Reference to YouTube Player instance
  const [ytPlayer, setYtPlayer] = useState(null);

  const [originalTranscript, setOriginalTranscript] = useState([]);
  const [fixedTranscript, setFixedTranscript] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentSegment, setCurrentSegment] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const transcriptContentRef = useRef(null);
  const [userScrolling, setUserScrolling] = useState(false);
  const userScrollTimeout = useRef(null);
  const [correctionStatus, setCorrectionStatus] = useState('idle'); // 'idle', 'loading', 'success', 'error'
  const [sections, setSections] = useState([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [sectionsSource, setSectionsSource] = useState(null);
  const [expandedChapters, setExpandedChapters] = useState([]);
  const [chapterPreviews, setChapterPreviews] = useState({});
  const [previewsLoading, setPreviewsLoading] = useState(false); // 'youtube' or 'ai'
  // Get the current video ID from window or props
  const currentVideoId = useMemo(() => window?.currentVideoId || videoId, [videoId]);
  
  // Use our custom hook to get corrected transcript
  const { transcript, isFixed, toggleFixed } = useTranscriptCorrection(videoId, originalTranscript, fixedTranscript);

  // Fetch sections for the video
  useEffect(() => {
    if (!currentVideoId) return;
    
    const fetchSections = async () => {
      setSectionsLoading(true);
      try {
        const response = await fetch(`/api/youtube/sections/${currentVideoId}`);
        if (response.ok) {
          const data = await response.json();
          setSections(data.sections || []);
          setSectionsSource(data.source);
          console.log(`[TranscriptViewer] Loaded ${data.sections?.length || 0} sections (source: ${data.source})`);
        } else {
          console.warn(`[TranscriptViewer] Failed to fetch sections: ${response.status}`);
        }
      } catch (error) {
        console.error('[TranscriptViewer] Error fetching sections:', error);
      } finally {
        setSectionsLoading(false);
      }
    };
    
    fetchSections();
  }, [currentVideoId]);

  // No correction status updates needed anymore
  useEffect(() => {
    // Always set to idle since transcript enhancement is disabled
    setCorrectionStatus('idle');
  }, []);

  // Process transcript: use sections if available, otherwise fall back to original grouping
  const processedTranscript = useMemo(() => {
    if (!transcript || transcript.length === 0) return [];
    
    // If we have sections, use them to create meaningful transcript segments
    if (sections && sections.length > 0) {
      return createSectionsFromTranscript(transcript, sections);
    }
    
    // Fall back to original grouping logic if no sections available
    return createGroupedTranscript(transcript);
  }, [transcript, sections]);

  // Create chapters display from sections
  const chaptersDisplay = useMemo(() => {
    if (!sections || sections.length === 0) return null;
    
    return sections.map((section, index) => ({
      id: index,
      start: section.start,
      title: section.title,
      formattedTime: section.formattedTime,
      isChapter: true
    }));
  }, [sections]);
  
  // Helper function to detect significant content overlap with safety checks
  function hasSignificantOverlap(text1, text2) {
    // Safety checks
    if (!text1 || !text2) return false;
    if (text1 === text2) return true;
    
    // Trim and normalize inputs
    text1 = text1.trim();
    text2 = text2.trim();
    
    // Quick returns for empty strings after trimming
    if (!text1 || !text2) return false;
    
    // Special case for very short texts - use direct comparison
    if (text1.length < 5 || text2.length < 5) {
      return text1 === text2;
    }
    
    // Get the longer and shorter texts
    const [longer, shorter] = text1.length >= text2.length 
      ? [text1.toLowerCase(), text2.toLowerCase()]
      : [text2.toLowerCase(), text1.toLowerCase()];
    
    // Check simple inclusion first (most efficient)
    if (longer.includes(shorter)) return true;
    
    // Calculate overlap threshold based on text length - more lenient for short texts
    const overlapThreshold = shorter.length < 20 ? 0.2 : 0.3;
    
    // Length-based quick filter - if lengths are very different, they're not similar
    if (shorter.length < longer.length * 0.3) return false;
    
    // Only do expensive Levenshtein calculation as a last resort,
    // and only for reasonably-sized inputs
    const MAX_COMPARISON_LENGTH = 500;
    if (longer.length <= MAX_COMPARISON_LENGTH) {
      return levenshteinDistance(longer, shorter) / longer.length < overlapThreshold;
    }
    
    // For long texts, compare word count profiles as a rough similarity heuristic
    const longerWords = longer.split(/\s+/).length;
    const shorterWords = shorter.split(/\s+/).length;
    return Math.abs(longerWords - shorterWords) / longerWords < 0.4;
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
  
  // Levenshtein distance for string similarity with safety checks and optimizations
  function levenshteinDistance(str1, str2) {
    // Safety check for null/undefined inputs
    if (!str1) str1 = '';
    if (!str2) str2 = '';
    
    // Quick return for identical strings or empty strings
    if (str1 === str2) return 0;
    if (str1.length === 0) return str2.length;
    if (str2.length === 0) return str1.length;
    
    // Maximum string length check to prevent excessive CPU/memory usage
    const MAX_LENGTH = 1000;
    if (str1.length > MAX_LENGTH || str2.length > MAX_LENGTH) {
      console.warn(`levenshteinDistance: String length exceeds ${MAX_LENGTH} chars, using approximate comparison`);
      
      // For very long strings, use a faster but less accurate approximation
      // 1. Check character frequency similarity
      // 2. Check start/end substrings
      // 3. Use sampling if needed
      
      if (Math.abs(str1.length - str2.length) > MAX_LENGTH / 2) {
        // If length differs significantly, strings are very different
        return Math.max(str1.length, str2.length);
      }
      
      // Compare first and last 100 characters
      const prefixDiff = levenshteinDistance(
        str1.substring(0, 100),
        str2.substring(0, 100)
      );
      
      const suffixDiff = levenshteinDistance(
        str1.substring(Math.max(0, str1.length - 100)),
        str2.substring(Math.max(0, str2.length - 100))
      );
      
      // Return a scaled approximation
      return prefixDiff + suffixDiff + 
        Math.floor((Math.abs(str1.length - str2.length) + Math.min(str1.length, str2.length)) * 0.5);
    }
    
    // Standard Levenshtein implementation for reasonable-sized strings
    const track = Array(str2.length + 1).fill(null).map(() => 
      Array(str1.length + 1).fill(null));
    
    // Initialize first row and column
    for (let i = 0; i <= str1.length; i += 1) {
      track[0][i] = i;
    }
    
    for (let j = 0; j <= str2.length; j += 1) {
      track[j][0] = j;
    }
    
    // Fill the matrix
    for (let j = 1; j <= str2.length; j += 1) {
      for (let i = 1; i <= str1.length; i += 1) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        track[j][i] = Math.min(
          track[j][i - 1] + 1, // deletion
          track[j - 1][i] + 1, // insertion
          track[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return track[str2.length][str1.length];
  }
  
  // Function to create sections from transcript using predefined or AI-generated sections
  function createSectionsFromTranscript(transcript, sections) {
    const result = [];
    
    sections.forEach((section, index) => {
      const nextSection = sections[index + 1];
      const sectionEnd = nextSection ? nextSection.start : transcript[transcript.length - 1]?.start + transcript[transcript.length - 1]?.duration || 0;
      
      // Find all transcript segments that fall within this section
      const sectionSegments = transcript.filter(segment => 
        segment.start >= section.start && segment.start < sectionEnd
      );
      
      if (sectionSegments.length > 0) {
        // Combine all text from segments in this section
        const sectionText = sectionSegments
          .map(segment => cleanTranscriptText(segment.text))
          .join(' ')
          .trim();
        
        if (sectionText) {
          result.push({
            start: section.start,
            duration: sectionEnd - section.start,
            text: sectionText,
            title: section.title,
            formattedTime: section.formattedTime,
            segments: sectionSegments,
            isSection: true,
            sectionSource: sectionsSource
          });
        }
      }
    });
    
    return result;
  }
  
  // Function to create grouped transcript (original logic as fallback)
  function createGroupedTranscript(transcript) {
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
  }
  
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
          setOriginalTranscript(data.transcript);
          console.log(`[TranscriptViewer] Received transcript with ${data.transcript.length} segments`);
          
          // Store fixed transcript if available
          if (data.fixedTranscript && data.usesFixedTranscript) {
            setFixedTranscript(data.fixedTranscript);
            setCorrectionStatus('success');
            console.log(`[TranscriptViewer] Received corrected transcript with ${data.fixedTranscript.length} segments`);
          } else {
            console.log(`[TranscriptViewer] No corrected transcript available. usesFixedTranscript: ${data.usesFixedTranscript}`);
          }
          
          // Send transcript data to parent component if callback provided
          if (typeof onTranscriptLoaded === 'function') {
            onTranscriptLoaded(data.fixedTranscript || data.transcript);
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
  }, [videoId]);
  
  // State to hold the player instance
  
  // Set initial segment on component mount
  useEffect(() => {
    if (!processedTranscript || processedTranscript.length === 0) return;
    
    // Set the first segment as active initially
    setCurrentSegment(processedTranscript[0]);
  }, [processedTranscript]);

  // Initialize YouTube player API
  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined') return;
    
    // Add listener for YouTube iframe API messages
    const handleYouTubeMessage = (event) => {
      try {
        // Check if this is a YouTube API message
        if (typeof event.data === 'string' && 
            event.data.indexOf('{"event":"') === 0) {
          const data = JSON.parse(event.data);
          
          // Handle player state changes
          if (data.event === 'onStateChange') {
            console.log('YouTube player state changed:', data.info);
            
            // Store player reference if available
            if (data.info && data.info.videoData && data.info.videoData.video_id === videoId) {
              if (!ytPlayer && window.player) {
                console.log('Setting player reference from event');
                setYtPlayer(window.player);
              }
            }
          }
          
          // Handle player ready event
          if (data.event === 'onReady') {
            console.log('YouTube player ready from event');
            if (!ytPlayer && window.player) {
              setYtPlayer(window.player);
            }
          }
          
          // Handle time update event (custom event)
          if (data.event === 'infoDelivery' && data.info && data.info.currentTime) {
            setCurrentTime(data.info.currentTime);
          }
        }
      } catch (e) {
        // Silently ignore errors parsing messages
      }
    };
    
    // Add postMessage listener
    window.addEventListener('message', handleYouTubeMessage);
    
    // Load YouTube API if not already loaded
    const loadYouTubeAPI = () => {
      if (window.YT && window.YT.Player) {
        YT = window.YT;
        initPlayer();
        return;
      }
      
      // Check if script is already loading
      if (document.getElementById('youtube-api-script')) {
        const originalCallback = window.onYouTubeIframeAPIReady || function() {};
        window.onYouTubeIframeAPIReady = () => {
          originalCallback();
          YT = window.YT;
          initPlayer();
        };
        return;
      }
      
      // Load API script
      const tag = document.createElement('script');
      tag.id = 'youtube-api-script';
      tag.src = 'https://www.youtube.com/iframe_api';
      
      window.onYouTubeIframeAPIReady = () => {
        console.log('YouTube API ready');
        YT = window.YT;
        initPlayer();
      };
      
      const firstScript = document.getElementsByTagName('script')[0];
      firstScript.parentNode.insertBefore(tag, firstScript);
    };
    
    loadYouTubeAPI();
    
    // Cleanup function to remove event listeners
    return () => {
      window.removeEventListener('message', handleYouTubeMessage);
    };
  }, [videoId]); // Added videoId as dependency
  
  // Initialize player when API is ready
  const initPlayer = () => {
    if (!YT || !YT.Player) return;
    
    console.log('Initializing YouTube player connection...');
    
    // Try to find the existing player
    setTimeout(() => {
      try {
        // First try window.player which might be set in YouTubePlayer.js
        if (window.player && typeof window.player.seekTo === 'function') {
          console.log('Found existing player in window.player');
          setYtPlayer(window.player);
          return;
        }
        
        // Then try to find iframe and create player instance
        const iframe = document.getElementById('youtube-player') || 
                      document.querySelector('iframe[src*="youtube.com/embed"]');
                      
        if (iframe) {
          console.log('Found YouTube iframe, connecting to it');
          try {
            const player = new YT.Player(iframe, {
              events: {
                onReady: (e) => {
                  console.log('YouTube player ready, can control:', e.target);
                  setYtPlayer(e.target);
                  
                  // Store global reference for other components
                  if (typeof window !== 'undefined') {
                    window.player = e.target;
                  }
                },
                onStateChange: (e) => {
                  console.log('YouTube player state changed:', e.data);
                }
              }
            });
          } catch (e) {
            console.error('Error creating YT.Player:', e);
            
            // Try alternative method
            try {
              // Use iframe directly to manipulate URL parameters
              if (iframe.src.indexOf('enablejsapi=1') === -1) {
                iframe.src = iframe.src.indexOf('?') !== -1 ? 
                  `${iframe.src}&enablejsapi=1` : 
                  `${iframe.src}?enablejsapi=1`;
              }
            } catch (innerError) {
              console.error('Error updating iframe:', innerError);
            }
          }
        }
      } catch (e) {
        console.error('Error initializing YouTube player:', e);
      }
    }, 1000); // Small delay to ensure iframe is loaded
  };

  // Function to handle segment click - uses YT API when possible
  const handleSegmentClick = (segment) => {
    // Handle edge case if no segment
    if (!segment || typeof segment.start !== 'number') {
      console.error('Invalid segment:', segment);
      return;
    }
    // Update the UI to show the selected segment
    setCurrentSegment(segment);
    
    // Fallback approach - update iframe directly
    
    // Calculate timestamp in seconds
    const timestamp = Math.floor(segment.start);
    
    // Log the segment click for debugging
    console.log(`Transcript segment clicked at ${timestamp}s:`, segment);
    
    // Try multiple approaches in order of preference
    let success = false;
    const iframe = document.getElementById('youtube-player') || 
                  document.querySelector('iframe[src*="youtube.com/embed"]');
    
    // Store whether a player exists before trying methods
    const hasYtPlayer = ytPlayer && typeof ytPlayer.seekTo === 'function';
    const hasWindowPlayer = window.player && typeof window.player.seekTo === 'function';
    const hasIframe = !!iframe;
    
    console.log('Available players:', {
      ytPlayer: hasYtPlayer,
      windowPlayer: hasWindowPlayer,
      iframe: hasIframe
    });
    
    // Method 1: Try YouTube API with improved sequence
    if (hasYtPlayer && !success) {
      try {
        console.log('Using YouTube API seekTo with improved sequence:', timestamp);
        
        // Get current playing state before seeking
        const wasPlaying = ytPlayer.getPlayerState() === 1;
        
        // First seek to position
        ytPlayer.seekTo(timestamp, true);
        
        // Then ensure it's playing with a small delay
        setTimeout(() => {
          // Double-check player state after seeking
          const currentState = ytPlayer.getPlayerState();
          console.log('Player state after seeking:', currentState);
          
          // Force play if it was playing before or now paused
          if (wasPlaying || currentState !== 1) {
            console.log('Forcing play after seek');
            ytPlayer.playVideo();
          }
        }, 100);
        
        success = true;
        
        // Call parent handler if provided
        if (typeof onSegmentClick === 'function') {
          onSegmentClick(segment);
        }
        return;
      } catch (e) {
        console.error('Error using YouTube API seekTo:', e);
      }
    }
    
    // Method 2: Try window.player with improved sequence
    if (hasWindowPlayer && !success) {
      try {
        console.log('Using window.player seekTo with improved sequence:', timestamp);
        
        // Get current playing state before seeking
        const wasPlaying = window.player.getPlayerState() === 1;
        
        // First seek to position
        window.player.seekTo(timestamp, true);
        
        // Then ensure it's playing with a small delay
        setTimeout(() => {
          // Double-check player state after seeking
          const currentState = window.player.getPlayerState();
          console.log('Player state after seeking:', currentState);
          
          // Force play if it was playing before or now paused
          if (wasPlaying || currentState !== 1) {
            console.log('Forcing play after seek');
            window.player.playVideo();
          }
        }, 100);
        
        success = true;
        
        // Call parent handler if provided
        if (typeof onSegmentClick === 'function') {
          onSegmentClick(segment);
        }
        return;
      } catch (e) {
        console.error('Error using window.player seekTo:', e);
      }
    }
    
    // Method 3: Direct iframe manipulation with special URL format
    if (hasIframe && !success) {
      try {
        console.log('Using direct iframe manipulation with special format');
        
        // Ensure iframe has proper allow attribute for autoplay
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
        
        // Use a special format that helps with continuous playback
        // The t parameter works better than start for maintaining playback
        // Adding playlist parameter helps with autoplay
        const specialUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&controls=1&t=${timestamp}s&playlist=${videoId}&rel=0&enablejsapi=1&cb=${new Date().getTime()}`;
        
        console.log('Setting iframe src to special format:', specialUrl);
        iframe.src = specialUrl;
        
        success = true;
        
        // Call parent handler if provided
        if (typeof onSegmentClick === 'function') {
          onSegmentClick(segment);
        }
        return;
      } catch (e) {
        console.error('Error with direct iframe manipulation:', e);
      }
    }
    
    // Last resort fallback: Create a new iframe for better autoplay support
    console.log('Using optimized iframe approach for continuous playback');
    try {
      const container = document.querySelector('.videoPlayer') || document.querySelector('[class*="videoPlayer"]');
      
      if (container) {
        // Create a new iframe with all necessary parameters
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
        
        // Special URL format for optimal autoplay behavior
        const cacheBuster = new Date().getTime();
        newIframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&controls=1&t=${timestamp}s&playlist=${videoId}&rel=0&enablejsapi=1&cb=${cacheBuster}&playsinline=1`;
        
        // Replace any existing iframe
        const existingIframe = document.getElementById('youtube-player') || 
                             container.querySelector('iframe');
        
        if (existingIframe) {
          console.log('Replacing existing iframe with new optimized iframe');
          existingIframe.parentNode.replaceChild(newIframe, existingIframe);
        } else {
          console.log('Adding new iframe to container');
          container.appendChild(newIframe);
        }
        
        console.log('Created new iframe with optimized parameters');
      } else {
        console.error('No video player container found for iframe replacement');
      }
    } catch (err) {
      console.error('Error creating optimized iframe:', err);
    }
    
    // Call parent handler if provided
    if (typeof onSegmentClick === 'function') {
      onSegmentClick(segment);
    }
  };

  // Load all previews in the background
  const loadAllPreviews = async (sectionsData) => {
    if (!transcript || transcript.length === 0) return;
    
    setPreviewsLoading(true);
    console.log('[TranscriptViewer] Loading all chapter previews...');
    
    try {
      const previewPromises = sectionsData.map(async (section, index) => {
        const chapterId = index;
        const chapterEnd = sectionsData[index + 1]?.start || Infinity;
        
        const response = await fetch(`/api/youtube/chapter-preview`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            videoId: currentVideoId,
            chapterTitle: section.title,
            chapterStart: section.start,
            chapterEnd: chapterEnd,
            transcript: transcript
          }),
        });

        if (response.ok) {
          const data = await response.json();
          return { chapterId, preview: data.preview };
        } else {
          console.error(`Failed to fetch preview for chapter ${section.title}`);
          return { chapterId, preview: null };
        }
      });

      const results = await Promise.all(previewPromises);
      const newPreviews = {};
      results.forEach(({ chapterId, preview }) => {
        if (preview) {
          newPreviews[chapterId] = preview;
        }
      });

      setChapterPreviews(newPreviews);
      console.log(`[TranscriptViewer] Loaded ${Object.keys(newPreviews).length} previews`);
    } catch (error) {
      console.error('[TranscriptViewer] Error loading previews:', error);
    } finally {
      setPreviewsLoading(false);
    }
  };

  // Load previews when transcript and sections are both available
  useEffect(() => {
    if (transcript && transcript.length > 0 && sections && sections.length > 0 && !previewsLoading) {
      console.log('[TranscriptViewer] Transcript and sections available, starting preview loading...');
      loadAllPreviews(sections);
    }
  }, [transcript, sections]);

  // Handle preview toggle
  const handlePreviewToggle = (chapterId, chapter) => {
    if (expandedChapters.includes(chapterId)) {
      // Collapse
      setExpandedChapters(expandedChapters.filter(id => id !== chapterId));
    } else {
      // Expand (preview is already loaded)
      setExpandedChapters([...expandedChapters, chapterId]);
    }
  };
  
  // Add effect to track current time from the YouTube player
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
  }, []);
  
  // Fallback time tracking using player instance directly
  useEffect(() => {
    if (!ytPlayer || typeof ytPlayer?.getCurrentTime !== 'function') return;
    
    // Function to update current time
    const updateCurrentTime = () => {
      try {
        // Try using the passed ytPlayer reference first
        if (ytPlayer && typeof ytPlayer.getCurrentTime === 'function') {
          const time = ytPlayer.getCurrentTime();
          setCurrentTime(time);
          return; // Success, exit early
        }
        
        // Fallbacks if the main player isn't available
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
        console.error('Error getting current time:', err);
      }
    };
    
    // Run immediately on first render
    updateCurrentTime();
    
    // Update current time every 500ms
    const interval = setInterval(updateCurrentTime, 500);
    
    return () => clearInterval(interval);
  }, [ytPlayer]);
  
  // Effect to find and highlight the current segment based on currentTime
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
              if (transcriptContentRef.current && !userScrolling) {
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
        }, [currentTime, processedTranscript, currentSegment, userScrolling]);
  
  // Render loading state
  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2>Transcript</h2>
          {correctionStatus === 'loading' && (
            <span className={styles.correctionBadge}>Enhancing transcript...</span>
          )}
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
          {correctionStatus === 'loading' && (
            <span className={styles.correctionBadge}>Enhancing transcript...</span>
          )}
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
          {correctionStatus === 'loading' && (
            <span className={styles.correctionBadge}>Enhancing transcript...</span>
          )}
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
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2>{sections && sections.length > 0 ? 'Chapters' : 'Transcript'}</h2>
          {sectionsSource && (
            <span className={`${styles.sectionsBadge} ${sectionsSource === 'youtube' ? styles.youtube : styles.ai}`}>
              {sectionsSource === 'youtube' ? 'YouTube Chapters' : 'AI Sections'}
            </span>
          )}

          {fixedTranscript && !sections && (
            <span 
              className={`${styles.transcriptBadge} ${isFixed ? styles.fixed : styles.original}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleFixed();
              }}
            >
              {isFixed ? 'AI-Fixed' : 'Original'}
            </span>
          )}
        </div>
        {sectionsLoading && (
          <div className={styles.sectionsLoading}>
            Loading sections...
          </div>
        )}
      </div>
      <div 
        ref={transcriptContentRef}
        className={styles.transcriptContent}
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
        }}
      >
        {sections && sections.length > 0 ? (
          // Display chapters
          chaptersDisplay.map((chapter, index) => (
            <div key={chapter.id} className={styles.chapterContainer}>
              <button
                className={`${styles.chapter} ${currentTime >= chapter.start && currentTime < (sections[index + 1]?.start || Infinity) ? styles.active : ''}`}
                onClick={() => handleSegmentClick(chapter)}
                aria-label={`Jump to ${chapter.formattedTime} - ${chapter.title}`}
                type="button"
                data-start-time={chapter.start}
              >
                <div className={styles.chapterTime}>
                  {chapter.formattedTime}
                </div>
                <div className={styles.chapterTitle}>
                  {chapter.title}
                </div>
              </button>
              <button
                className={`${styles.previewButton} ${expandedChapters.includes(chapter.id) ? styles.expanded : ''} ${previewsLoading ? styles.loading : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!previewsLoading) {
                    handlePreviewToggle(chapter.id, chapter);
                  }
                }}
                aria-label={`Preview ${chapter.title}`}
                type="button"
                disabled={previewsLoading}
              >
                <span className={styles.previewArrow}>
                  {previewsLoading ? '⏳' : (expandedChapters.includes(chapter.id) ? '▼' : '▶')}
                </span>
              </button>
              {expandedChapters.includes(chapter.id) && (
                <div className={styles.previewContent}>
                  {chapterPreviews[chapter.id] ? (
                    <div className={styles.previewText}>
                      {chapterPreviews[chapter.id]}
                    </div>
                  ) : (
                    <div className={styles.previewLoading}>
                      Generating preview...
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        ) : (
          // Display transcript segments (fallback)
          processedTranscript.map((segment, index) => (
            <div key={index} className={styles.segmentContainer}>
              {segment.isSection && segment.title && (
                <div className={styles.sectionTitle}>
                  <span className={styles.sectionTitleText}>{segment.title}</span>
                  <span className={styles.sectionTime}>{segment.formattedTime}</span>
                </div>
              )}
              <button
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
            </div>
          ))
        )}
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