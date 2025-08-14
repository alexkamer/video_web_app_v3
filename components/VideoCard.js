import { useState } from 'react';
import styles from '../styles/VideoCard.module.css';

// Map of YouTube category IDs to human-readable names
const categoryMap = {
  '1': 'Film & Animation',
  '2': 'Autos & Vehicles',
  '10': 'Music',
  '15': 'Pets & Animals',
  '17': 'Sports',
  '18': 'Short Movies',
  '19': 'Travel & Events',
  '20': 'Gaming',
  '21': 'Videoblogging',
  '22': 'People & Blogs',
  '23': 'Comedy',
  '24': 'Entertainment',
  '25': 'News & Politics',
  '26': 'Howto & Style',
  '27': 'Education',
  '28': 'Science & Technology',
  '29': 'Nonprofits & Activism',
  '30': 'Movies',
  '31': 'Anime/Animation',
  '32': 'Action/Adventure',
  '33': 'Classics',
  '34': 'Comedy',
  '35': 'Documentary',
  '36': 'Drama',
  '37': 'Family',
  '38': 'Foreign',
  '39': 'Horror',
  '40': 'Sci-Fi/Fantasy',
  '41': 'Thriller',
  '42': 'Shorts',
  '43': 'Shows',
  '44': 'Trailers'
};

// Format view count with commas
const formatNumber = (num) => {
  if (!num) return '';
  return parseInt(num).toLocaleString();
};

// Format duration from ISO 8601 to human-readable format
const formatDuration = (isoDuration) => {
  if (!isoDuration) return '';
  
  // Remove PT from the beginning
  const duration = isoDuration.replace('PT', '');
  
  let hours = 0;
  let minutes = 0;
  let seconds = 0;
  
  // Extract hours, minutes, and seconds
  if (duration.includes('H')) {
    hours = parseInt(duration.split('H')[0]);
    minutes = parseInt(duration.split('H')[1].split('M')[0] || 0);
    seconds = parseInt(duration.split('M')[1]?.replace('S', '') || 0);
  } else if (duration.includes('M')) {
    minutes = parseInt(duration.split('M')[0]);
    seconds = parseInt(duration.split('M')[1]?.replace('S', '') || 0);
  } else if (duration.includes('S')) {
    seconds = parseInt(duration.replace('S', ''));
  }
  
  // Format the duration
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
};

// Decode HTML entities
const decodeHtmlEntities = (text) => {
  if (!text) return '';
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
};

export default function VideoCard({ video }) {
  const [showDetails, setShowDetails] = useState(false);
  
  // Get video ID based on response format
  const videoId = video.id?.videoId || video.id;
  
  // Extract tags (limit to 5 for display)
  const tags = video.tags || video.snippet?.tags || [];
  const displayTags = tags.slice(0, 5);
  
  // Get category
  const categoryId = video.categoryId || (video.snippet?.categoryId ? video.snippet.categoryId : null);
  const category = categoryId ? categoryMap[categoryId] || 'Uncategorized' : 'Uncategorized';
  
  // Get statistics if available
  const statistics = video.statistics || {};
  const viewCount = statistics.viewCount ? formatNumber(statistics.viewCount) : '';
  const likeCount = statistics.likeCount ? formatNumber(statistics.likeCount) : '';
  
  // Get duration if available
  const duration = video.contentDetails?.duration ? 
    formatDuration(video.contentDetails.duration) : '';
  
  // Toggle details view
  const toggleDetails = () => {
    setShowDetails(!showDetails);
  };
  
  return (
    <div className={styles.card}>
      <div className={styles.thumbnail}>
        <a href={`/watch/${videoId}`} className={styles.thumbnailLink}>
          <img 
            src={video.snippet.thumbnails.medium.url} 
            alt={decodeHtmlEntities(video.snippet.title)}
          />
          {duration && <div className={styles.duration}>{duration}</div>}
        </a>
      </div>
      <div className={styles.content}>
        <h3 className={styles.title}>
          <a href={`/watch/${videoId}`} className={styles.titleLink}>
            {decodeHtmlEntities(video.snippet.title)}
          </a>
        </h3>
        <p className={styles.description}>{decodeHtmlEntities(video.snippet.description)}</p>
        
        <div className={styles.meta}>
          <span className={styles.channel}>{video.snippet.channelTitle}</span>
          <span className={styles.date}>
            {new Date(video.snippet.publishedAt).toLocaleDateString()}
          </span>
          {viewCount && <span className={styles.views}>{viewCount} views</span>}
        </div>
        
        {showDetails && (
          <div className={styles.details}>
            {category && (
              <div className={styles.category}>
                <span className={styles.label}>Category:</span> {category}
              </div>
            )}
            
            {displayTags.length > 0 && (
              <div className={styles.tags}>
                <span className={styles.label}>Tags:</span>
                <div className={styles.tagList}>
                  {displayTags.map((tag, index) => (
                    <span key={index} className={styles.tag}>{tag}</span>
                  ))}
                  {tags.length > 5 && <span className={styles.moreTags}>+{tags.length - 5} more</span>}
                </div>
              </div>
            )}
            
            {likeCount && (
              <div className={styles.likes}>
                <span className={styles.label}>Likes:</span> {likeCount}
              </div>
            )}
          </div>
        )}
        
        <div className={styles.actions}>
          <a 
            href={`/watch/${videoId}`}
            className={styles.watchButton}
          >
            Watch
          </a>
          
          <button 
            onClick={toggleDetails} 
            className={styles.detailsButton}
          >
            {showDetails ? 'Hide Details' : 'Show Details'}
          </button>
        </div>
      </div>
    </div>
  );
}