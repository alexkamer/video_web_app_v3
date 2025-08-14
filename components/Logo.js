import Link from 'next/link';
import styles from '../styles/Logo.module.css';

export default function Logo() {
  return (
    <Link href="/" className={styles.logo}>
      <span className={styles.videoText}>Video</span>
      <span className={styles.learnText}>Learn</span>
    </Link>
  );
}