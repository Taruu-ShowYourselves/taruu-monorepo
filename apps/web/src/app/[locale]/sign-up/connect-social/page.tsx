'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { NewsButton } from '@/components/press/NewsButton';
import { useAuth } from '@/providers/AuthProvider';
import { getIdentityLevelLabel } from '@sync/shared';
import styles from './page.module.css';

export default function ConnectSocialPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/sign-in');
    }
  }, [isLoading, isAuthenticated, router]);

  const handleConnectFacebook = async () => {
    setConnecting('facebook');
    setConnectionError(null);
    try {
      // Redirect to Facebook OAuth (correct API endpoint path)
      window.location.href = '/api/social/connect/facebook';
    } catch (error) {
      console.error('Facebook connect error:', error);
      setConnectionError('שגיאה בהתחברות לפייסבוק');
      setConnecting(null);
    }
  };

  const handleConnectInstagram = async () => {
    setConnecting('instagram');
    setConnectionError(null);
    try {
      // Redirect to Instagram OAuth (correct API endpoint path)
      window.location.href = '/api/social/connect/instagram';
    } catch (error) {
      console.error('Instagram connect error:', error);
      setConnectionError('שגיאה בהתחברות לאינסטגרם');
      setConnecting(null);
    }
  };

  const handleContinue = () => {
    router.push('/dashboard');
  };

  const handleSkip = () => {
    router.push('/dashboard');
  };

  // Check for successful/failed connection from URL params
  // Note: OAuth callbacks redirect to /settings/social-connections, but user may return here
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected') || params.get('success');
    const error = params.get('error');

    if (connected) {
      setConnectedPlatforms((prev) =>
        prev.includes(connected) ? prev : [...prev, connected]
      );
      // Clean up URL
      router.replace('/sign-up/connect-social');
    }

    if (error) {
      setConnectionError(decodeURIComponent(error));
      router.replace('/sign-up/connect-social');
    }
  }, [router]);

  // Load existing social proofs from user profile
  useEffect(() => {
    if (user?.socialProofs && Array.isArray(user.socialProofs)) {
      const connected = user.socialProofs.map(
        (proof: { platform: string }) => proof.platform.toLowerCase()
      );
      setConnectedPlatforms(connected);
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} aria-hidden />
        <p>טוען…</p>
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
          <header className={styles.head}>
            <span className={styles.kicker}>
              <span aria-hidden className={styles.kickerTick} />
              אימות זהות · IDENTITY
            </span>
            <h1 className={styles.title}>
              שפרו את <span className={styles.red}>ציון הזהות.</span>
            </h1>
            <p className={styles.standfirst}>
              חברו עוד רשתות חברתיות לאימות זהות מלא ולגישה לכל ההצבעות.
            </p>
          </header>

          {/* Current score */}
          <section className={styles.scoreCard}>
            <div className={styles.scoreHeader}>
              <span className={styles.scoreLabel}>הציון הנוכחי שלכם</span>
              <span className={styles.scoreBadge}>{currentScore}/100</span>
            </div>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ inlineSize: `${currentScore}%` }}
                aria-hidden
              />
            </div>
            <span className={styles.levelText}>רמה · {currentLevel}</span>
          </section>

          {/* Error */}
          {connectionError && (
            <div className={styles.errorMessage} role="alert">
              <span aria-hidden className={styles.errorGlyph}>
                ✕
              </span>
              <p>{connectionError}</p>
              <button
                className={styles.dismissError}
                onClick={() => setConnectionError(null)}
                aria-label="סגור"
              >
                ✕
              </button>
            </div>
          )}

          {/* Social platforms */}
          <ul className={styles.platforms}>
            {/* Google — already connected */}
            <li className={`${styles.row} ${styles.connected}`}>
              <div className={styles.rowInfo}>
                <span className={`${styles.rowIcon} ${styles.google}`} aria-hidden>
                  G
                </span>
                <div className={styles.rowText}>
                  <h3>Google</h3>
                  <p className={styles.rowMeta}>מחובר</p>
                </div>
              </div>
              <div className={styles.rowStatus}>
                <span className={styles.statusOn}>
                  <span aria-hidden>✓ </span>מחובר
                </span>
                <span className={styles.points}>+40 נקודות</span>
              </div>
            </li>

            {/* Facebook */}
            <li className={`${styles.row} ${facebookConnected ? styles.connected : ''}`}>
              <div className={styles.rowInfo}>
                <span className={`${styles.rowIcon} ${styles.facebook}`} aria-hidden>
                  f
                </span>
                <div className={styles.rowText}>
                  <h3>Facebook</h3>
                  <p className={styles.rowMeta}>
                    {facebookConnected ? 'מחובר' : '+30 נקודות לציון'}
                  </p>
                </div>
              </div>
              <div className={styles.rowStatus}>
                {facebookConnected ? (
                  <>
                    <span className={styles.statusOn}>
                      <span aria-hidden>✓ </span>מחובר
                    </span>
                    <span className={styles.points}>+30 נקודות</span>
                  </>
                ) : (
                  <NewsButton
                    variant="ink"
                    size="sm"
                    onClick={handleConnectFacebook}
                    disabled={connecting === 'facebook'}
                  >
                    {connecting === 'facebook' ? 'מתחבר…' : 'חברו'}
                  </NewsButton>
                )}
              </div>
            </li>

            {/* Instagram */}
            <li className={`${styles.row} ${instagramConnected ? styles.connected : ''}`}>
              <div className={styles.rowInfo}>
                <span className={`${styles.rowIcon} ${styles.instagram}`} aria-hidden>
                  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                </span>
                <div className={styles.rowText}>
                  <h3>Instagram</h3>
                  <p className={styles.rowMeta}>
                    {instagramConnected ? 'מחובר' : '+30 נקודות לציון'}
                  </p>
                </div>
              </div>
              <div className={styles.rowStatus}>
                {instagramConnected ? (
                  <>
                    <span className={styles.statusOn}>
                      <span aria-hidden>✓ </span>מחובר
                    </span>
                    <span className={styles.points}>+30 נקודות</span>
                  </>
                ) : (
                  <NewsButton
                    variant="ink"
                    size="sm"
                    onClick={handleConnectInstagram}
                    disabled={connecting === 'instagram'}
                  >
                    {connecting === 'instagram' ? 'מתחבר…' : 'חברו'}
                  </NewsButton>
                )}
              </div>
            </li>
          </ul>

          {/* Privacy note */}
          <div className={styles.info}>
            <span aria-hidden className={styles.infoGlyph}>
              ■
            </span>
            <p>
              אנחנו לא מפרסמים בשמכם ולא משתפים מידע. החיבור משמש לאימות זהות
              בלבד.
            </p>
          </div>

          {/* Actions */}
          <div className={styles.actions}>
            <NewsButton
              variant="red"
              size="lg"
              className={styles.primaryBtn}
              onClick={handleContinue}
              trailing={<span aria-hidden>←</span>}
            >
              {connectedPlatforms.length > 0 ? 'המשך לאפליקציה' : 'המשך בלי לחבר'}
            </NewsButton>
            {connectedPlatforms.length === 0 && (
              <button className={styles.skipButton} onClick={handleSkip}>
                אפשר לחבר גם אחר כך בהגדרות
              </button>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
