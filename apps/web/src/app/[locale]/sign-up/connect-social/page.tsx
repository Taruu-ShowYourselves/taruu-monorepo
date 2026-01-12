'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/providers/AuthProvider';
import { getIdentityLevelLabel } from '@sync/shared';
import styles from './page.module.css';

export default function ConnectSocialPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/sign-in');
    }
  }, [isLoading, isAuthenticated, router]);

  const handleConnectFacebook = async () => {
    setConnecting('facebook');
    try {
      // Redirect to Facebook OAuth
      const redirectUrl = `${window.location.origin}/api/social/callback/facebook`;
      const facebookAuthUrl = `/api/social/facebook/connect?redirect_uri=${encodeURIComponent(redirectUrl)}`;
      window.location.href = facebookAuthUrl;
    } catch (error) {
      console.error('Facebook connect error:', error);
      setConnecting(null);
    }
  };

  const handleConnectInstagram = async () => {
    setConnecting('instagram');
    try {
      // Redirect to Instagram OAuth
      const redirectUrl = `${window.location.origin}/api/social/callback/instagram`;
      const instagramAuthUrl = `/api/social/instagram/connect?redirect_uri=${encodeURIComponent(redirectUrl)}`;
      window.location.href = instagramAuthUrl;
    } catch (error) {
      console.error('Instagram connect error:', error);
      setConnecting(null);
    }
  };

  const handleContinue = () => {
    router.push('/dashboard');
  };

  const handleSkip = () => {
    router.push('/dashboard');
  };

  // Check for successful connection from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    if (connected) {
      setConnectedPlatforms((prev) => [...prev, connected]);
      // Clean up URL
      router.replace('/sign-up/connect-social');
    }
  }, [router]);

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <p>טוען...</p>
      </div>
    );
  }

  const currentScore = user?.identityScore?.total || 40;
  const currentLevel = getIdentityLevelLabel(user?.identityScore?.level || 'basic');
  const facebookConnected = connectedPlatforms.includes('facebook');
  const instagramConnected = connectedPlatforms.includes('instagram');

  return (
    <>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          {/* Header */}
          <motion.div
            className={styles.header}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1>שפרו את ציון הזהות</h1>
            <p>
              חברו עוד רשתות חברתיות לאימות זהות מלא ולגישה לכל ההצבעות
            </p>
          </motion.div>

          {/* Current Score Card */}
          <motion.div
            className={styles.scoreCard}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className={styles.scoreHeader}>
              <span>הציון הנוכחי שלכם</span>
              <span className={styles.scoreBadge}>{currentScore}/100</span>
            </div>
            <div className={styles.progressBar}>
              <motion.div
                className={styles.progressFill}
                initial={{ width: 0 }}
                animate={{ width: `${currentScore}%` }}
                transition={{ duration: 0.8, delay: 0.3 }}
              />
            </div>
            <span className={styles.levelText}>רמה: {currentLevel}</span>
          </motion.div>

          {/* Social Platforms */}
          <div className={styles.platforms}>
            {/* Google - Already Connected */}
            <motion.div
              className={`${styles.platformCard} ${styles.connected}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <div className={styles.platformInfo}>
                <div className={`${styles.platformIcon} ${styles.google}`}>G</div>
                <div className={styles.platformText}>
                  <h3>Google</h3>
                  <p>מחובר</p>
                </div>
              </div>
              <div className={styles.platformStatus}>
                <span className={styles.checkmark}>✓</span>
                <span className={styles.points}>+40 נקודות</span>
              </div>
            </motion.div>

            {/* Facebook */}
            <motion.div
              className={`${styles.platformCard} ${facebookConnected ? styles.connected : ''}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
            >
              <div className={styles.platformInfo}>
                <div className={`${styles.platformIcon} ${styles.facebook}`}>f</div>
                <div className={styles.platformText}>
                  <h3>Facebook</h3>
                  <p>{facebookConnected ? 'מחובר' : 'הוסיפו 30 נקודות לציון'}</p>
                </div>
              </div>
              <div className={styles.platformStatus}>
                {facebookConnected ? (
                  <>
                    <span className={styles.checkmark}>✓</span>
                    <span className={styles.points}>+30 נקודות</span>
                  </>
                ) : (
                  <Button
                    onClick={handleConnectFacebook}
                    disabled={connecting === 'facebook'}
                    size="sm"
                    className={styles.facebookButton}
                  >
                    {connecting === 'facebook' ? 'מתחבר...' : 'חבר'}
                  </Button>
                )}
              </div>
            </motion.div>

            {/* Instagram */}
            <motion.div
              className={`${styles.platformCard} ${instagramConnected ? styles.connected : ''}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.4 }}
            >
              <div className={styles.platformInfo}>
                <div className={`${styles.platformIcon} ${styles.instagram}`}>
                  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                </div>
                <div className={styles.platformText}>
                  <h3>Instagram</h3>
                  <p>{instagramConnected ? 'מחובר' : 'הוסיפו 30 נקודות לציון'}</p>
                </div>
              </div>
              <div className={styles.platformStatus}>
                {instagramConnected ? (
                  <>
                    <span className={styles.checkmark}>✓</span>
                    <span className={styles.points}>+30 נקודות</span>
                  </>
                ) : (
                  <Button
                    onClick={handleConnectInstagram}
                    disabled={connecting === 'instagram'}
                    size="sm"
                    className={styles.instagramButton}
                  >
                    {connecting === 'instagram' ? 'מתחבר...' : 'חבר'}
                  </Button>
                )}
              </div>
            </motion.div>
          </div>

          {/* Info */}
          <motion.div
            className={styles.info}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <span className={styles.infoIcon}>🛡️</span>
            <p>
              אנחנו לא מפרסמים בשמכם ולא משתפים מידע. החיבור משמש לאימות זהות בלבד.
            </p>
          </motion.div>

          {/* Actions */}
          <motion.div
            className={styles.actions}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <Button onClick={handleContinue} size="large">
              {connectedPlatforms.length > 0 ? 'המשך לאפליקציה' : 'המשך בלי לחבר'}
            </Button>
            {connectedPlatforms.length === 0 && (
              <button className={styles.skipButton} onClick={handleSkip}>
                אפשר לחבר גם אחר כך בהגדרות
              </button>
            )}
          </motion.div>
        </div>
      </main>
      <Footer />
    </>
  );
}
