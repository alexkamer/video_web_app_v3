import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import styles from '../styles/Home.module.css';
import SearchBar from '../components/SearchBar';
import Logo from '../components/Logo';

export default function Home() {
  const router = useRouter();
  const [searchHistory, setSearchHistory] = useState([]);

  // Load search history from localStorage on first load
  useEffect(() => {
    const savedHistory = localStorage.getItem('searchHistory');
    if (savedHistory) {
      try {
        setSearchHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Failed to parse search history:', e);
      }
    }
  }, []);

  const handleSearch = (query) => {
    if (query && query.trim()) {
      const trimmedQuery = query.trim();
      
      // Save to search history
      const newHistory = [trimmedQuery, ...searchHistory.filter(item => item !== trimmedQuery)].slice(0, 5);
      setSearchHistory(newHistory);
      localStorage.setItem('searchHistory', JSON.stringify(newHistory));
      
      // Redirect to results page with the search query and default preferences
      router.push(`/results?search_query=${encodeURIComponent(trimmedQuery)}&caption=any`);
    }
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Video Learning App</title>
        <meta name="description" content="Search and learn from videos" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <div className={styles.logoContainer}>
          <Logo />
        </div>
        
        <h1 className={styles.title}>
          Welcome to <span>Video Learning</span>
        </h1>

        <p className={styles.description}>
          Search for videos, watch, and test your knowledge
        </p>

        <div className={styles.homeSearchBar}>
          <SearchBar onSearch={handleSearch} />
        </div>
        
        {searchHistory.length > 0 && (
          <div className={styles.history}>
            <h3>Recent Searches:</h3>
            <div className={styles.historyItems}>
              {searchHistory.map((item, index) => (
                <button 
                  key={index}
                  className={styles.historyItem}
                  onClick={() => handleSearch(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={styles.grid}>
          <div className={styles.card}>
            <h2>Search &rarr;</h2>
            <p>Find videos on topics you want to learn about.</p>
          </div>

          <div className={styles.card}>
            <h2>Watch &rarr;</h2>
            <p>Watch videos with enhanced learning features.</p>
          </div>

          <div className={styles.card}>
            <h2>Quiz &rarr;</h2>
            <p>Test your understanding with interactive quizzes.</p>
          </div>

          <div className={styles.card}>
            <h2>Learn &rarr;</h2>
            <p>Get AI-powered insights and summaries.</p>
          </div>
        </div>
      </main>

      <footer className={styles.footer}>
        <p>Video Learning App</p>
      </footer>
    </div>
  );
}