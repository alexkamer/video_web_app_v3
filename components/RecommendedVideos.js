import { useState, useEffect } from 'react';
import styles from '../styles/RecommendedVideos.module.css';
import VideoCard from './VideoCard';
import { getRecommendedVideos } from '../utils/recommendations';

export default function RecommendedVideos({ currentVideo, allVideos }) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentVideo && allVideos && allVideos.length > 0) {
      // Calculate recommendations
      const recs = getRecommendedVideos(currentVideo, allVideos);
      setRecommendations(recs);
    }
    
    setLoading(false);
  }, [currentVideo, allVideos]);

  if (loading) {
    return <div className={styles.loading}>Finding recommendations...</div>;
  }

  if (recommendations.length === 0) {
    return null;
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Recommended Videos</h3>
      <div className={styles.recommendations}>
        {recommendations.map((rec) => (
          <div key={rec.video.id.videoId || rec.video.id} className={styles.recommendation}>
            <VideoCard video={rec.video} />
            <div className={styles.similarityScore}>
              <span className={styles.label}>Similarity: </span>
              <div className={styles.scoreBar}>
                <div 
                  className={styles.scoreValue}
                  style={{ width: `${rec.score}%` }}
                ></div>
              </div>
              <span className={styles.scoreNumber}>{rec.score}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}