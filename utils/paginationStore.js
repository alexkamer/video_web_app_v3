/**
 * Utility to manage pagination tokens for YouTube API
 * 
 * Since YouTube API uses tokens rather than page numbers,
 * we need to maintain a mapping between our page numbers and their tokens
 */

class PaginationStore {
  constructor() {
    // Initialize the token map
    this.tokenMap = new Map();
    
    // Always set page 1 to have no token (first page)
    this.tokenMap.set(1, null);
    
    // Keep track of the current maximum page
    this.maxPage = 1;
    
    // Store the current query to reset when query changes
    this.currentQuery = '';
  }
  
  // Reset the store when query changes
  reset(query) {
    if (this.currentQuery !== query) {
      this.tokenMap = new Map();
      this.tokenMap.set(1, null);
      this.maxPage = 1;
      this.currentQuery = query;
    }
  }
  
  // Store a new page token
  addPageToken(pageNumber, token) {
    this.tokenMap.set(pageNumber, token);
    if (pageNumber > this.maxPage) {
      this.maxPage = pageNumber;
    }
  }
  
  // Get token for a specific page
  getTokenForPage(pageNumber) {
    return this.tokenMap.get(pageNumber) || null;
  }
  
  // Get the highest page number we know about
  getMaxPage() {
    return this.maxPage;
  }
  
  // Get all known pages and their tokens
  getAllPages() {
    return Array.from(this.tokenMap.keys()).sort((a, b) => a - b);
  }
}

// Export a singleton instance
const paginationStore = new PaginationStore();
export default paginationStore;