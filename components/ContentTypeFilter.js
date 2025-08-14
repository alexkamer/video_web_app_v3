import { useState, useEffect, useRef } from 'react';
import styles from '../styles/ContentTypeFilter.module.css';

// Content type options
const CONTENT_TYPES = {
  ALL: 'all',
  VIDEO: 'video',
  SHORT: 'short'
};

// Video duration options
const VIDEO_DURATIONS = {
  ANY: 'any',
  SHORT: 'short',
  MEDIUM: 'medium',
  LONG: 'long'
};

// Video caption options
const VIDEO_CAPTIONS = {
  ANY: 'any',
  WITH_CAPTIONS: 'closedCaption',
  WITHOUT_CAPTIONS: 'none'
};

// Video definition (quality) options
const VIDEO_QUALITY = {
  ANY: 'any',
  HD: 'high',
  STANDARD: 'standard'
};

// Upload date options
const UPLOAD_DATE = {
  ANY: 'any',
  TODAY: 'today',
  THIS_WEEK: 'week',
  THIS_MONTH: 'month',
  THIS_YEAR: 'year'
};

// Sort order options
const SORT_ORDER = {
  RELEVANCE: 'relevance',
  DATE: 'date',
  VIEW_COUNT: 'viewCount',
  RATING: 'rating',
  TITLE: 'title'
};

export default function ContentTypeFilter({ 
  selectedType, 
  onTypeChange, 
  selectedDuration = VIDEO_DURATIONS.ANY,
  onDurationChange,
  selectedCaption = VIDEO_CAPTIONS.ANY,
  onCaptionChange,
  selectedQuality = VIDEO_QUALITY.ANY,
  onQualityChange,
  selectedUploadDate = UPLOAD_DATE.ANY,
  onUploadDateChange,
  selectedSortOrder = SORT_ORDER.RELEVANCE,
  onSortOrderChange,
  onResetFilters
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [scrollPosition, setScrollPosition] = useState('top');
  const filterContentRef = useRef(null);

  // Map content type to display name
  const getDisplayName = (type) => {
    switch(type) {
      case CONTENT_TYPES.ALL:
        return 'All';
      case CONTENT_TYPES.VIDEO:
        return 'Videos';
      case CONTENT_TYPES.SHORT:
        return 'Shorts';
      default:
        return 'All';
    }
  };

  // Map duration to display name
  const getDurationDisplayName = (duration) => {
    switch(duration) {
      case VIDEO_DURATIONS.ANY:
        return 'Any Duration';
      case VIDEO_DURATIONS.SHORT:
        return 'Under 4 min';
      case VIDEO_DURATIONS.MEDIUM:
        return '4-20 min';
      case VIDEO_DURATIONS.LONG:
        return 'Over 20 min';
      default:
        return 'Any Duration';
    }
  };

  // Map caption to display name
  const getCaptionDisplayName = (caption) => {
    switch(caption) {
      case VIDEO_CAPTIONS.ANY:
        return 'Any Caption';
      case VIDEO_CAPTIONS.WITH_CAPTIONS:
        return 'With Captions';
      case VIDEO_CAPTIONS.WITHOUT_CAPTIONS:
        return 'Without Captions';
      default:
        return 'Any Caption';
    }
  };

  // Map quality to display name
  const getQualityDisplayName = (quality) => {
    switch(quality) {
      case VIDEO_QUALITY.ANY:
        return 'Any Quality';
      case VIDEO_QUALITY.HD:
        return 'HD Only';
      case VIDEO_QUALITY.STANDARD:
        return 'Standard Only';
      default:
        return 'Any Quality';
    }
  };

  // Map upload date to display name
  const getUploadDateDisplayName = (uploadDate) => {
    switch(uploadDate) {
      case UPLOAD_DATE.ANY:
        return 'Any Time';
      case UPLOAD_DATE.TODAY:
        return 'Today';
      case UPLOAD_DATE.THIS_WEEK:
        return 'This Week';
      case UPLOAD_DATE.THIS_MONTH:
        return 'This Month';
      case UPLOAD_DATE.THIS_YEAR:
        return 'This Year';
      default:
        return 'Any Time';
    }
  };

  // Map sort order to display name
  const getSortOrderDisplayName = (sortOrder) => {
    switch(sortOrder) {
      case SORT_ORDER.RELEVANCE:
        return 'Best Match';
      case SORT_ORDER.DATE:
        return 'Newest First';
      case SORT_ORDER.VIEW_COUNT:
        return 'Most Popular';
      case SORT_ORDER.RATING:
        return 'Highest Rated';
      case SORT_ORDER.TITLE:
        return 'Alphabetical';
      default:
        return 'Best Match';
    }
  };

  // Get active filter count for the badge
  const getActiveFilterCount = () => {
    let count = 0;
    if (selectedType !== CONTENT_TYPES.ALL) count++;
    if (selectedDuration !== VIDEO_DURATIONS.ANY) count++;
    if (selectedCaption !== VIDEO_CAPTIONS.ANY) count++;
    if (selectedQuality !== VIDEO_QUALITY.ANY) count++;
    if (selectedUploadDate !== UPLOAD_DATE.ANY) count++;
    if (selectedSortOrder !== SORT_ORDER.RELEVANCE) count++;
    return count;
  };

  // Check if a filter option is the default
  const isDefaultOption = (filterType, value) => {
    switch (filterType) {
      case 'type':
        return value === CONTENT_TYPES.ALL;
      case 'duration':
        return value === VIDEO_DURATIONS.ANY;
      case 'caption':
        return value === VIDEO_CAPTIONS.ANY;
      case 'quality':
        return value === VIDEO_QUALITY.ANY;
      case 'uploadDate':
        return value === UPLOAD_DATE.ANY;
      case 'sortOrder':
        return value === SORT_ORDER.RELEVANCE;
      default:
        return false;
    }
  };

  // Handle scroll position detection
  const handleScroll = () => {
    if (!filterContentRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = filterContentRef.current;
    const isAtTop = scrollTop === 0;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 5; // 5px tolerance
    
    if (isAtTop) {
      setScrollPosition('top');
    } else if (isAtBottom) {
      setScrollPosition('bottom');
    } else {
      setScrollPosition('middle');
    }
  };

  // Add scroll event listener when expanded
  useEffect(() => {
    if (isExpanded && filterContentRef.current) {
      const element = filterContentRef.current;
      element.addEventListener('scroll', handleScroll);
      return () => element.removeEventListener('scroll', handleScroll);
    }
  }, [isExpanded]);

  // Get active filter details for tooltip
  const getActiveFilterDetails = () => {
    const activeFilters = [];
    if (selectedType !== CONTENT_TYPES.ALL) activeFilters.push(`Type: ${getDisplayName(selectedType)}`);
    if (selectedDuration !== VIDEO_DURATIONS.ANY) activeFilters.push(`Duration: ${getDurationDisplayName(selectedDuration)}`);
    if (selectedCaption !== VIDEO_CAPTIONS.ANY) activeFilters.push(`Captions: ${getCaptionDisplayName(selectedCaption)}`);
    if (selectedQuality !== VIDEO_QUALITY.ANY) activeFilters.push(`Quality: ${getQualityDisplayName(selectedQuality)}`);
    if (selectedUploadDate !== UPLOAD_DATE.ANY) activeFilters.push(`Date: ${getUploadDateDisplayName(selectedUploadDate)}`);
    if (selectedSortOrder !== SORT_ORDER.RELEVANCE) activeFilters.push(`Sort: ${getSortOrderDisplayName(selectedSortOrder)}`);
    return activeFilters.join(', ');
  };

  const activeFilterCount = getActiveFilterCount();

  return (
    <div className={styles.filterContainer}>
      {/* Collapsible Header */}
      <div className={styles.filterHeader}>
        <div className={styles.filterHeaderContent} onClick={() => setIsExpanded(!isExpanded)}>
          <h3 className={styles.filterTitle}>
            <span className={styles.filterIcon}>{isExpanded ? '▼' : '▶'}</span>
            Search Filters
            {activeFilterCount > 0 && (
              <span 
                className={styles.activeFilterBadge}
                title={getActiveFilterDetails()}
              >
                {activeFilterCount}
              </span>
            )}
          </h3>
          <span className={styles.filterSubtitle}>
            {isExpanded ? 'Click to collapse' : 'Click to expand'}
          </span>
        </div>
        {activeFilterCount > 0 && (
          <button 
            className={styles.resetButton}
            onClick={(e) => {
              e.stopPropagation();
              onResetFilters();
            }}
            title="Reset all filters to default"
          >
            Reset
          </button>
        )}
      </div>

      {/* Collapsible Content */}
      <div 
        ref={filterContentRef}
        className={`${styles.filterContent} ${isExpanded ? styles.expanded : ''}`}
      >
        {/* Top Scroll Indicator - only show when at top */}
        {isExpanded && scrollPosition === 'top' && (
          <div className={styles.scrollIndicator}>
            <div className={styles.scrollArrow}>↓</div>
            <span className={styles.scrollText}>Scroll down for more filters</span>
          </div>
        )}
        
        {/* Content Type Filters */}
        <div className={styles.filterSection}>
          <h4 className={styles.filterLabel}>Content Type:</h4>
          <div className={styles.filterButtonsGroup}>
            {Object.values(CONTENT_TYPES).map((type) => (
              <button
                key={type}
                className={`${styles.filterButton} ${selectedType === type ? styles.active : ''} ${isDefaultOption('type', type) ? styles.default : ''}`}
                onClick={() => onTypeChange(type)}
                aria-pressed={selectedType === type}
              >
                {getDisplayName(type)}
              </button>
            ))}
          </div>
        </div>

        {/* Video Duration Filters */}
        <div className={styles.filterSection}>
          <h4 className={styles.filterLabel}>Duration:</h4>
          <div className={styles.filterButtonsGroup}>
            {Object.values(VIDEO_DURATIONS).map((duration) => (
              <button
                key={duration}
                className={`${styles.filterButton} ${selectedDuration === duration ? styles.active : ''} ${isDefaultOption('duration', duration) ? styles.default : ''}`}
                onClick={() => onDurationChange(duration)}
                aria-pressed={selectedDuration === duration}
              >
                {getDurationDisplayName(duration)}
              </button>
            ))}
          </div>
        </div>

        {/* Video Caption Filters */}
        <div className={styles.filterSection}>
          <h4 className={styles.filterLabel}>Captions:</h4>
          <div className={styles.filterButtonsGroup}>
            {Object.values(VIDEO_CAPTIONS).map((caption) => (
              <button
                key={caption}
                className={`${styles.filterButton} ${selectedCaption === caption ? styles.active : ''} ${isDefaultOption('caption', caption) ? styles.default : ''}`}
                onClick={() => onCaptionChange(caption)}
                aria-pressed={selectedCaption === caption}
              >
                {getCaptionDisplayName(caption)}
              </button>
            ))}
          </div>
        </div>

        {/* Video Quality Filters */}
        <div className={styles.filterSection}>
          <h4 className={styles.filterLabel}>Quality:</h4>
          <div className={styles.filterButtonsGroup}>
            {Object.values(VIDEO_QUALITY).map((quality) => (
              <button
                key={quality}
                className={`${styles.filterButton} ${selectedQuality === quality ? styles.active : ''} ${isDefaultOption('quality', quality) ? styles.default : ''}`}
                onClick={() => onQualityChange(quality)}
                aria-pressed={selectedQuality === quality}
              >
                {getQualityDisplayName(quality)}
              </button>
            ))}
          </div>
        </div>

        {/* Upload Date Filters */}
        <div className={styles.filterSection}>
          <h4 className={styles.filterLabel}>Upload Date:</h4>
          <div className={styles.filterButtonsGroup}>
            {Object.values(UPLOAD_DATE).map((uploadDate) => (
              <button
                key={uploadDate}
                className={`${styles.filterButton} ${selectedUploadDate === uploadDate ? styles.active : ''} ${isDefaultOption('uploadDate', uploadDate) ? styles.default : ''}`}
                onClick={() => onUploadDateChange(uploadDate)}
                aria-pressed={selectedUploadDate === uploadDate}
              >
                {getUploadDateDisplayName(uploadDate)}
              </button>
            ))}
          </div>
        </div>

        {/* Sort Order Filters */}
        <div className={styles.filterSection}>
          <h4 className={styles.filterLabel}>Sort By:</h4>
          <div className={styles.filterButtonsGroup}>
            {Object.values(SORT_ORDER).map((sortOrder) => (
              <button
                key={sortOrder}
                className={`${styles.filterButton} ${selectedSortOrder === sortOrder ? styles.active : ''} ${isDefaultOption('sortOrder', sortOrder) ? styles.default : ''}`}
                onClick={() => onSortOrderChange(sortOrder)}
                aria-pressed={selectedSortOrder === sortOrder}
              >
                {getSortOrderDisplayName(sortOrder)}
              </button>
            ))}
          </div>
        </div>
        
        {/* Bottom Scroll Indicator - only show when at bottom */}
        {isExpanded && scrollPosition === 'bottom' && (
          <div className={styles.scrollIndicatorBottom}>
            <div className={styles.scrollArrowUp}>↑</div>
            <span className={styles.scrollText}>Scroll up for more filters</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Export all filter options for use in other components
export { CONTENT_TYPES, VIDEO_DURATIONS, VIDEO_CAPTIONS, VIDEO_QUALITY, UPLOAD_DATE, SORT_ORDER };