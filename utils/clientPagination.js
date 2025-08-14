/**
 * Client-side pagination utility for YouTube search results
 * This allows us to paginate results without making additional API requests
 */

/**
 * Paginate an array of items
 * 
 * @param {Array} items - Array of items to paginate
 * @param {number} page - Current page number (1-based)
 * @param {number} pageSize - Number of items per page
 * @returns {Object} - Pagination info and paginated items
 */
export function paginateItems(items, page = 1, pageSize = 10) {
  // Validate input
  if (!Array.isArray(items)) {
    return {
      items: [],
      pageInfo: {
        totalResults: 0,
        resultsPerPage: pageSize,
        totalPages: 0
      },
      currentPage: page
    };
  }
  
  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const currentPage = Math.max(1, Math.min(page, totalPages));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  
  // Get items for the current page
  const paginatedItems = items.slice(startIndex, endIndex);
  
  return {
    items: paginatedItems,
    pageInfo: {
      totalResults: totalItems,
      resultsPerPage: pageSize,
      totalPages
    },
    currentPage,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1
  };
}