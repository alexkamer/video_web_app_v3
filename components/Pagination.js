import { useRouter } from 'next/router';
import Link from 'next/link';
import styles from '../styles/Pagination.module.css';

export default function Pagination({ 
  pageInfo,
  currentPage = 1,
  searchQuery,
  hasNextPage,
  hasPrevPage,
  contentType = 'all',
  duration = 'any',
  caption = 'any',
  quality = 'any',
  uploadDate = 'any',
  sortOrder = 'relevance'
}) {
  const router = useRouter();
  
  // Get pagination info
  const resultsPerPage = pageInfo?.resultsPerPage || 10;
  const totalResults = pageInfo?.totalResults || 0;
  const totalPages = pageInfo?.totalPages || Math.ceil(totalResults / resultsPerPage);
  
  // Maximum number of page links to show
  const MAX_PAGE_LINKS = 7;
  
  // Generate array of page numbers to display
  const getPageNumbers = () => {
    // If we have 7 or fewer pages, show all of them
    if (totalPages <= MAX_PAGE_LINKS) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    
    // Otherwise, show a window around the current page
    let pages = [];
    const halfWindow = Math.floor(MAX_PAGE_LINKS / 2);
    
    // Always include page 1
    pages.push(1);
    
    // Calculate start and end of the window
    let windowStart = Math.max(2, currentPage - halfWindow);
    let windowEnd = Math.min(totalPages - 1, currentPage + halfWindow);
    
    // Adjust window if we're near the beginning or end
    if (currentPage <= halfWindow + 1) {
      windowEnd = MAX_PAGE_LINKS - 1;
    } else if (currentPage >= totalPages - halfWindow) {
      windowStart = totalPages - MAX_PAGE_LINKS + 2;
    }
    
    // Add ellipsis after page 1 if needed
    if (windowStart > 2) {
      pages.push('...');
    }
    
    // Add pages in the window
    for (let i = windowStart; i <= windowEnd; i++) {
      pages.push(i);
    }
    
    // Add ellipsis before last page if needed
    if (windowEnd < totalPages - 1) {
      pages.push('...');
    }
    
    // Always include the last page if we have more than one page
    if (totalPages > 1) {
      pages.push(totalPages);
    }
    
    return pages;
  };
  
  // Generate page numbers
  const pageNumbers = getPageNumbers();
  
  // Only render if we have pagination info
  if (totalResults <= resultsPerPage) {
    return null;
  }

  return (
    <div className={styles.pagination}>
      {totalResults > 0 && (
        <div className={styles.info}>
          Showing {resultsPerPage} of {totalResults.toLocaleString()} results
        </div>
      )}
      
      <div className={styles.pageNumbers}>
        {/* Previous button */}
        {hasPrevPage && (
          <Link 
            href={`/results?search_query=${encodeURIComponent(searchQuery)}&content_type=${contentType}&duration=${duration}&caption=${caption}&quality=${quality}&uploadDate=${uploadDate}&sortOrder=${sortOrder}&page=${currentPage - 1}`}
            className={`${styles.pageButton} ${styles.navButton}`}
          >
            &lt; Prev
          </Link>
        )}
        
        {/* Page numbers */}
        {pageNumbers.map((page, index) => 
          page === '...' ? (
            <span key={`ellipsis-${index}`} className={styles.ellipsis}>...</span>
          ) : (
            <Link
              key={page}
              href={`/results?search_query=${encodeURIComponent(searchQuery)}&content_type=${contentType}&duration=${duration}&caption=${caption}&quality=${quality}&uploadDate=${uploadDate}&sortOrder=${sortOrder}&page=${page}`}
              className={`${styles.pageButton} ${page === currentPage ? styles.active : ''}`}
            >
              {page}
            </Link>
          )
        )}
        
        {/* Next button */}
        {hasNextPage && (
          <Link 
            href={`/results?search_query=${encodeURIComponent(searchQuery)}&content_type=${contentType}&duration=${duration}&caption=${caption}&quality=${quality}&uploadDate=${uploadDate}&sortOrder=${sortOrder}&page=${currentPage + 1}`}
            className={`${styles.pageButton} ${styles.navButton}`}
          >
            Next &gt;
          </Link>
        )}
      </div>
    </div>
  );
}