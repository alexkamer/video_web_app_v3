import Link from 'next/link';
import { useRouter } from 'next/router';
import styles from '../styles/Header.module.css';

export default function Header() {
  const router = useRouter();

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <Link href="/" className={styles.logo}>
          VideoLearn
        </Link>
        
        <nav className={styles.nav}>
          <Link href="/" className={router.pathname === '/' ? styles.active : ''}>
            Home
          </Link>
          <Link href="/browse" className={router.pathname === '/browse' ? styles.active : ''}>
            Browse
          </Link>
          <Link href="/saved" className={router.pathname === '/saved' ? styles.active : ''}>
            Saved
          </Link>
        </nav>

        <div className={styles.userSection}>
          <button className={styles.loginButton}>Login</button>
        </div>
      </div>
    </header>
  );
}