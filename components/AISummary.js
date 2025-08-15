import { useState, useEffect } from 'react';
import styles from '../styles/AISummary.module.css';
import ReactMarkdown from 'react-markdown';

// Helper function to clean summary output from debug logs
const cleanSummaryOutput = (rawSummary) => {
  if (!rawSummary) return '';
  
  // Remove any lines containing memory usage information
  let cleanedText = rawSummary.replace(/.*memory usage.*$/gmi, '');
  
  // Remove processing log lines
  cleanedText = cleanedText.replace(/^(Starting|Processing|Memory|Summarizing|Created|Correcting|Transcript|Chunk|Detecting|Processed|Template).*$/gm, '');
  
  // Remove chunk processing summary section
  cleanedText = cleanedText.replace(/CHUNK PROCESSING SUMMARY:([\s\S]*?)(?=\n\n|$)/, '');
  
  // Remove lines with checkmarks, error symbols and processing stats
  cleanedText = cleanedText.replace(/^[\s]*[✓❌].*$/gm, '');
  
  // Clean up multiple blank lines
  cleanedText = cleanedText.replace(/\n{3,}/g, '\n\n');
  
  // Trim whitespace
  return cleanedText.trim();
};

export default function AISummary({ videoId, videoTitle, transcript, onSummaryLoaded, onLoadingChange, existingSummary }) {
  const [summary, setSummary] = useState(existingSummary || '');
  const [loading, setLoading] = useState(!existingSummary);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [processingTime, setProcessingTime] = useState(null);

  // Function to generate summary - moved outside useEffect so it can be called from retry button
  const generateSummary = async () => {
    if (!videoId || !transcript || transcript.length === 0) {
      setLoading(false);
      setError('Missing required data for summary generation.');
      return;
    }
    
    setLoading(true);
    setError(null);
    setSummary('');
    setProcessingTime(null);
    
    // Notify parent component about loading state
    if (onLoadingChange) {
      onLoadingChange(true);
    }
    
    // Track start time for performance measurement
    const startTime = Date.now();
    
    try {
      // Always use the Python-based team summarization approach
      const usePython = true;
      
      const response = await fetch('/api/youtube/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript,
          videoTitle,
          videoId,
          usePython, // Always true to use the Python-based team summarization
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate summary');
      }
      
      const data = await response.json();
      
      if (data.success && data.summary) {
        // Process the summary to remove debug logs
        const cleanedSummary = cleanSummaryOutput(data.summary);
        setSummary(cleanedSummary);
        if (onSummaryLoaded) {
          onSummaryLoaded(cleanedSummary);
        }
        
        // Calculate and store processing time
        const endTime = Date.now();
        const timeInSeconds = ((endTime - startTime) / 1000).toFixed(1);
        setProcessingTime(timeInSeconds);
        
        // Auto-expand when summary is ready
        setIsExpanded(true);
      } else {
        throw new Error('Invalid summary data received');
      }
    } catch (err) {
      console.error('Error generating summary:', err);
      setError(err.message || 'Failed to generate summary');
    } finally {
      setLoading(false);
      
      // Notify parent component about loading state
      if (onLoadingChange) {
        onLoadingChange(false);
      }
    }
  };

  // Generate summary when component loads or when mode/data changes
  useEffect(() => {
    // If we already have a summary, don't generate a new one
    if (existingSummary && existingSummary !== summary) {
      setSummary(existingSummary);
      setLoading(false);
      setIsExpanded(true);
      if (onSummaryLoaded) {
        onSummaryLoaded(existingSummary);
      }
      return;
    }
    
    // Only generate if we don't have a summary
    if (!summary) {
      generateSummary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, videoTitle, transcript?.length, existingSummary]); // Using transcript.length to avoid deep comparison

  // Render markdown summary
  const formattedSummary = summary ? (
    <>
      <div className={styles.summaryType}>
        <span className={styles.summaryTypeBadge}>
          AI Summary
        </span>
        {processingTime && <span className={styles.processingTime}>⚡ Generated in {processingTime}s</span>}
      </div>
      <div className={styles.markdown}>
        <ReactMarkdown
          components={{
            a: ({ node, ...props }) => (
              <a 
                {...props} 
                target="_blank" 
                rel="noopener noreferrer"
                className={styles.externalLink}
              />
            ),
          }}
        >
          {summary}
        </ReactMarkdown>
      </div>
    </>
  ) : null;
  
  return (
    <div className={styles.container}>
      <div 
        className={styles.header} 
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h2>AI Video Summary</h2>
        <div className={styles.controls}>
          <button className={styles.toggleButton}>
            {isExpanded ? '↑ Hide Summary' : '↓ Show Summary'}
          </button>
        </div>
      </div>
      
      <div className={`${styles.content} ${isExpanded ? '' : styles.collapsed}`}>
        {loading ? (
          <div className={styles.loading}>
            <div className={styles.loadingText}>
              🧠 Generating AI summary...
              <span>May take a minute or two to complete</span>
            </div>
          </div>
        ) : error ? (
          <div className={styles.error}>
            <div className={styles.errorMessage}>
              <strong>Summary Generation Failed</strong>
              <p>{error}</p>
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                generateSummary();
              }} 
              className={styles.retryButton}
            >
              Try again
            </button>
          </div>
        ) : summary ? (
          <div className={styles.summary}>
            {formattedSummary}
          </div>
        ) : (
          <div className={styles.empty}>
            <p>No summary available yet</p>
            <span>The summary will be generated automatically</span>
          </div>
        )}
      </div>
    </div>
  );
}