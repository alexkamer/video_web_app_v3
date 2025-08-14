import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import styles from '../styles/Results.module.css';
import ContentTypeFilter, { CONTENT_TYPES, VIDEO_DURATIONS, VIDEO_CAPTIONS, VIDEO_QUALITY, UPLOAD_DATE, SORT_ORDER } from '../components/ContentTypeFilter';
import SearchBar from '../components/SearchBar';
import VideoCard from '../components/VideoCard';
import Logo from '../components/Logo';
import Pagination from '../components/Pagination';
import { paginateItems } from '../utils/clientPagination';

export default function ResultsPage() {
  const router = useRouter();
  const { search_query: encodedQuery, page, content_type, duration, caption, quality, uploadDate, sortOrder } = router.query;
  
  // Decode the search query for display
  const search_query = encodedQuery ? decodeURIComponent(encodedQuery) : '';
  
  const [videos, setVideos] = useState([]);
  const [filteredVideos, setFilteredVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [contentType, setContentType] = useState(CONTENT_TYPES.ALL);
  const [selectedDuration, setSelectedDuration] = useState(VIDEO_DURATIONS.ANY);
  const [selectedCaption, setSelectedCaption] = useState(VIDEO_CAPTIONS.ANY);
  const [selectedQuality, setSelectedQuality] = useState(VIDEO_QUALITY.ANY);
  const [selectedUploadDate, setSelectedUploadDate] = useState(UPLOAD_DATE.ANY);
  const [selectedSortOrder, setSelectedSortOrder] = useState(SORT_ORDER.RELEVANCE);
  const [allVideos, setAllVideos] = useState([]);
  const [paginationInfo, setPaginationInfo] = useState({
    pageInfo: { totalResults: 0, resultsPerPage: 10, totalPages: 0 },
    currentPage: 1,
    hasNextPage: false,
    hasPrevPage: false
  });


  // Determine current page from URL or default to 1
  useEffect(() => {
    const pageNum = page ? parseInt(page) : 1;
    setCurrentPage(pageNum);
  }, [page]);
  
  // Set content type from URL or default to ALL
  useEffect(() => {
    if (content_type && Object.values(CONTENT_TYPES).includes(content_type)) {
      setContentType(content_type);
    } else {
      setContentType(CONTENT_TYPES.ALL);
    }
  }, [content_type]);

  // Set duration from URL or default to ANY
  useEffect(() => {
    if (duration && Object.values(VIDEO_DURATIONS).includes(duration)) {
      setSelectedDuration(duration);
    } else {
      setSelectedDuration(VIDEO_DURATIONS.ANY);
    }
  }, [duration]);

  // Set caption from URL or default to WITH_CAPTIONS
  useEffect(() => {
    if (caption && Object.values(VIDEO_CAPTIONS).includes(caption)) {
      setSelectedCaption(caption);
    } else {
      setSelectedCaption(VIDEO_CAPTIONS.WITH_CAPTIONS);
    }
  }, [caption]);

  // Set quality from URL or default to ANY
  useEffect(() => {
    if (quality && Object.values(VIDEO_QUALITY).includes(quality)) {
      setSelectedQuality(quality);
    } else {
      setSelectedQuality(VIDEO_QUALITY.ANY);
    }
  }, [quality]);

  // Set upload date from URL or default to ANY
  useEffect(() => {
    if (uploadDate && Object.values(UPLOAD_DATE).includes(uploadDate)) {
      setSelectedUploadDate(uploadDate);
    } else {
      setSelectedUploadDate(UPLOAD_DATE.ANY);
    }
  }, [uploadDate]);

  // Set sort order from URL or default to RELEVANCE
  useEffect(() => {
    if (sortOrder && Object.values(SORT_ORDER).includes(sortOrder)) {
      setSelectedSortOrder(sortOrder);
    } else {
      setSelectedSortOrder(SORT_ORDER.RELEVANCE);
    }
  }, [sortOrder]);

  // Cleanup effect to reset loading state on unmount
  useEffect(() => {
    return () => {
      setLoading(false);
      setError(null);
    };
  }, []);

  // Reset all filters to default values
  const handleResetFilters = () => {
    const resetParams = {
      search_query: encodedQuery,
      page: '1',
      content_type: CONTENT_TYPES.ALL,
      duration: VIDEO_DURATIONS.ANY,
      caption: VIDEO_CAPTIONS.WITH_CAPTIONS,
      quality: VIDEO_QUALITY.ANY,
      uploadDate: UPLOAD_DATE.ANY,
      sortOrder: SORT_ORDER.RELEVANCE
    };
    
    router.push({
      pathname: router.pathname,
      query: resetParams
    });
  };



  
  // Apply client-side filtering based on content type
  useEffect(() => {
    if (!videos.length) {
      setFilteredVideos([]);
      return;
    }
    
    // Apply client-side filtering for short vs regular videos
    if (contentType === CONTENT_TYPES.SHORT) {
      // For videos marked as shorts (duration <= 60 seconds)
      setFilteredVideos(videos.filter(video => video.isShort === true));
    } else if (contentType === CONTENT_TYPES.VIDEO) {
      // For regular videos (duration > 60 seconds)
      setFilteredVideos(videos.filter(video => video.isShort === false));
    } else {
      // For "All" content type, show everything
      setFilteredVideos(videos);
    }
  }, [videos, contentType]);

  // Perform search when query, content type, duration, caption, quality, upload date, or sort order changes
  useEffect(() => {
    if (!search_query) return;
    
    let abortController = null;
    
    const doSearch = async () => {
      // Reset to page 1 when doing a new search
      abortController = await performSearch(search_query, contentType, selectedDuration, selectedCaption, selectedQuality, selectedUploadDate, selectedSortOrder);
    };
    
    doSearch();
    
    // Cleanup function to abort any pending requests when dependencies change
    return () => {
      if (abortController) {
        abortController.abort();
      }
    };
  }, [search_query, contentType, selectedDuration, selectedCaption, selectedQuality, selectedUploadDate, selectedSortOrder]);
  
  // Apply pagination when page or filtered videos change
  useEffect(() => {
    if (videos.length > 0) {
      // Apply client-side pagination to the videos
      const pageSize = 10; // Number of videos per page
      const paginatedData = paginateItems(videos, currentPage, pageSize);
      
      setAllVideos(videos); // Store all videos
      setFilteredVideos(paginatedData.items); // Set current page's videos
      setPaginationInfo({
        pageInfo: paginatedData.pageInfo,
        currentPage: paginatedData.currentPage,
        hasNextPage: paginatedData.hasNextPage,
        hasPrevPage: paginatedData.hasPrevPage
      });
    }
  }, [videos, currentPage]);
  
  
  const performSearch = async (query, type = CONTENT_TYPES.ALL, duration = VIDEO_DURATIONS.ANY, caption = VIDEO_CAPTIONS.WITH_CAPTIONS, quality = VIDEO_QUALITY.ANY, uploadDate = UPLOAD_DATE.ANY, sortOrder = SORT_ORDER.RELEVANCE) => {
    // Create an abort controller to handle component unmounting
    const abortController = new AbortController();
    
    // Add a timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      abortController.abort();
      setError('Request timed out. Please try again.');
      setLoading(false);
    }, 30000); // 30 second timeout
    
    setLoading(true);
    setError(null);
    
    try {
      // Build URL with search query, content type, duration, caption, quality, upload date, and sort order, no pagination tokens
      const url = `/api/youtube/search?query=${encodeURIComponent(query)}&contentType=${type}&duration=${duration}&caption=${caption}&quality=${quality}&uploadDate=${uploadDate}&sortOrder=${sortOrder}`;
      
      const response = await fetch(url, {
        signal: abortController.signal
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch videos');
      }
      
      const data = await response.json();
      
      // Only update state if the component is still mounted and this is the latest request
      setVideos(data.items || []);
      
      // Add to search history
      const savedHistory = localStorage.getItem('searchHistory');
      let searchHistory = [];
      
      if (savedHistory) {
        try {
          searchHistory = JSON.parse(savedHistory);
        } catch (e) {
          console.error('Failed to parse search history:', e);
        }
      }
      
      if (query && !searchHistory.includes(query)) {
        const updatedHistory = [query, ...searchHistory.slice(0, 9)];
        localStorage.setItem('searchHistory', JSON.stringify(updatedHistory));
      }
      
    } catch (err) {
      // Don't set error if the request was aborted (component unmounted)
      if (err.name === 'AbortError') {
        return;
      }
      
      console.error('Search error:', err);
      setError(err.message);
      setVideos([]);
    } finally {
      // Clear the timeout
      clearTimeout(timeoutId);
      // Only update loading state if the component is still mounted
      setLoading(false);
    }
    
    // Return the abort controller so it can be cleaned up
    return abortController;
  };

  const handleSearch = (query) => {
    // Update URL with new search query (reset pagination)
    router.push({
      pathname: '/results',
      query: {
        search_query: encodeURIComponent(query),
        content_type: contentType,
        duration: selectedDuration,
        caption: selectedCaption,
        quality: selectedQuality,
        uploadDate: selectedUploadDate,
        sortOrder: selectedSortOrder
      }
    });
  };
  
  const handleContentTypeChange = (type) => {
    // Update URL with new content type
    router.push({
      pathname: '/results',
      query: {
        ...router.query,
        content_type: type,
        duration: selectedDuration,
        caption: selectedCaption,
        quality: selectedQuality,
        uploadDate: selectedUploadDate,
        sortOrder: selectedSortOrder,
        page: 1 // Reset to page 1
      }
    });
    
    setContentType(type);
  };

  const handleDurationChange = (duration) => {
    // Update URL with new duration
    router.push({
      pathname: '/results',
      query: {
        ...router.query,
        duration: duration,
        caption: selectedCaption,
        quality: selectedQuality,
        uploadDate: selectedUploadDate,
        sortOrder: selectedSortOrder,
        page: 1 // Reset to page 1
      }
    });
    
    setSelectedDuration(duration);
  };

  const handleCaptionChange = (caption) => {
    // Update URL with new caption preference
    router.push({
      pathname: '/results',
      query: {
        ...router.query,
        caption: caption,
        quality: selectedQuality,
        uploadDate: selectedUploadDate,
        sortOrder: selectedSortOrder,
        page: 1 // Reset to page 1
      }
    });
    
    setSelectedCaption(caption);
  };

  const handleQualityChange = (quality) => {
    // Update URL with new quality preference
    router.push({
      pathname: '/results',
      query: {
        ...router.query,
        quality: quality,
        uploadDate: selectedUploadDate,
        sortOrder: selectedSortOrder,
        page: 1 // Reset to page 1
      }
    });
    
    setSelectedQuality(quality);
  };

  const handleUploadDateChange = (uploadDate) => {
    // Update URL with new upload date preference
    router.push({
      pathname: '/results',
      query: {
        ...router.query,
        uploadDate: uploadDate,
        page: 1 // Reset to page 1
      }
    });
    
    setSelectedUploadDate(uploadDate);
  };

  const handleSortOrderChange = (sortOrder) => {
    // Update URL with new sort order preference
    router.push({
      pathname: '/results',
      query: {
        ...router.query,
        sortOrder: sortOrder,
        page: 1 // Reset to page 1
      }
    });
    
    setSelectedSortOrder(sortOrder);
  };


  

  return (
    <div className={styles.container}>
      <Head>
        <title>
          {search_query 
            ? `${search_query} - ${contentType !== CONTENT_TYPES.ALL ? (contentType === CONTENT_TYPES.VIDEO ? 'Videos' : 'Shorts') : 'All'} - Page ${currentPage} - Search Results - Video Learning`
            : 'Search Results - Video Learning'}
        </title>
        <meta name="description" content={`Search results for ${search_query || 'videos'}`} />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header className={styles.header}>
        <div className={styles.headerContent}>
          <Logo />
          <div className={styles.searchAndFiltersRow}>
            <div className={styles.searchBarContainer}>
              <SearchBar onSearch={handleSearch} initialQuery={search_query} />
            </div>
            
            <div className={styles.filtersContainer}>
              <ContentTypeFilter 
                selectedType={contentType} 
                onTypeChange={handleContentTypeChange}
                selectedDuration={selectedDuration}
                onDurationChange={handleDurationChange}
                selectedCaption={selectedCaption}
                onCaptionChange={handleCaptionChange}
                selectedQuality={selectedQuality}
                onQualityChange={handleQualityChange}
                selectedUploadDate={selectedUploadDate}
                onUploadDateChange={handleUploadDateChange}
                selectedSortOrder={selectedSortOrder}
                onSortOrderChange={handleSortOrderChange}
                onResetFilters={handleResetFilters}
              />
            </div>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        {search_query && (
          <div className={styles.resultsHeader}>
            <h1 className={styles.resultsTitle}>
              Search results for <span>&ldquo;{search_query}&rdquo;</span>
              {currentPage > 1 && <span className={styles.pageIndicator}> - Page {currentPage}</span>}
            </h1>
          </div>
        )}
        

        {loading && (
          <div className={styles.loading}>Loading...</div>
        )}

        {error && (
          <div className={styles.error}>{error}</div>
        )}

        {filteredVideos.length > 0 ? (
          <>
            <div className={styles.results}>
              {filteredVideos.map((video) => (
                <div 
                  key={video.id.videoId || video.id} 
                  className={styles.videoCardWrapper}
                >
                  <VideoCard video={video} />
                </div>
              ))}
            </div>
            
            {/* Show pagination */}
            {(
                          <Pagination 
              pageInfo={paginationInfo.pageInfo}
              currentPage={currentPage}
              searchQuery={search_query}
              hasNextPage={paginationInfo.hasNextPage}
              hasPrevPage={paginationInfo.hasPrevPage}
              contentType={contentType}
              duration={selectedDuration}
              caption={selectedCaption}
              quality={selectedQuality}
              uploadDate={selectedUploadDate}
              sortOrder={selectedSortOrder}
            />
            )}
          </>
        ) : videos.length > 0 && filteredVideos.length === 0 ? (
          <div className={styles.noResults}>
            No {contentType === CONTENT_TYPES.SHORT ? 'short videos' : 'regular videos'} found matching your search.
            Try a different filter or search term.
          </div>
        ) : !loading && !error ? (
          <div className={styles.noResults}>
            {
              'No videos found. Try a different search term.'
            }
          </div>
        ) : null}
      </main>
    </div>
  );
}