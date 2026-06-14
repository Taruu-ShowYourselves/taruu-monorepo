'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { NewsButton } from '@/components/press/NewsButton';
import {
  redirectToFacebookAuth,
  redirectToInstagramAuth,
} from '@/services/auth';
import { getIdentityLevelLabel, getIdentityLevelDescription } from '@sync/shared';
import type { SocialProof, IdentityScore } from '@sync/shared';
import styles from './page.module.css';

interface SocialProofsData {
  socialProofs: SocialProof[];
  identityScore: IdentityScore;
}

function SocialConnectionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [data, setData] = useState<SocialProofsData | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check for success/error from URL params
  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (success) {
      const platformNames: Record<string, string> = {
        facebook: 'פייסבוק',
        instagram: 'אינסטגרם',
      };
      setSuccessMessage(`${platformNames[success] || success} חובר בהצלחה!`);
      // Clear URL params
      router.replace('/settings/social-connections');
    }

    if (error) {
      setErrorMessage(decodeURIComponent(error));
      router.replace('/settings/social-connections');
    }
  }, [searchParams, router]);

  // Fetch social proofs
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/sign-in?redirect=/settings/social-connections');
      return;
    }

    const fetchData = async () => {
      try {
        const response = await fetch('/api/social/proofs');
        if (response.ok) {
          const result = await response.json();
          setData(result);
        }
      } catch (error) {
        console.error('Error fetching social proofs:', error);
      } finally {
        setDataLoading(false);
      }
    };

    if (isAuthenticated) {
      fetchData();
    }
  }, [isLoading, isAuthenticated, router]);

  const handleConnectFacebook = () => {
    if (user?.id) {
      redirectToFacebookAuth(user.id);
    }
  };

  const handleConnectInstagram = () => {
    if (user?.id) {
      redirectToInstagramAuth(user.id);
    }
  };

  const handleDisconnect = async (platform: string) => {
    setDisconnecting(platform);
    try {
      const response = await fetch(`/api/social/proofs?platform=${platform}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const result = await response.json();
        setData(result);
        setSuccessMessage(`${platform === 'facebook' ? 'פייסבוק' : 'אינסטגרם'} נותק בהצלחה`);
      } else {
        const error = await response.json();
        setErrorMessage(error.error || 'שגיאה בניתוק');
      }
    } catch (error) {
      setErrorMessage('שגיאה בניתוק');
    } finally {
      setDisconnecting(null);
    }
  };

  if (isLoading || dataLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} aria-hidden />
        <p>טוען…</p>
      </div>
    );
  }

  const socialProofs = data?.socialProofs || [];
  const identityScore = data?.identityScore || user?.identityScore;
  const googleProof = socialProofs.find((p) => p.platform === 'google');
  const facebookProof = socialProofs.find((p) => p.platform === 'facebook');
  const instagramProof = socialProofs.find((p) => p.platform === 'instagram');

  return (
    <>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          <header className={styles.head}>
            <span className={styles.kicker}>
              <span aria-hidden className={styles.kickerTick} />
              הגדרות · CONNECTIONS
            </span>
            <h1 className={styles.title}>
              חיבור <span className={styles.red}>רשתות חברתיות.</span>
            </h1>
            <p className={styles.standfirst}>
              חברו את הרשתות החברתיות שלכם כדי להגדיל את ציון הזהות ולקבל גישה
              מלאה לפלטפורמה.
            </p>
          </header>

          {/* Messages */}
          {successMessage && (
            <div className={`${styles.message} ${styles.success}`} role="status">
              <span aria-hidden className={styles.msgGlyph}>
                ✓
              </span>
              <p>{successMessage}</p>
              <button onClick={() => setSuccessMessage(null)} aria-label="סגור">
                ✕
              </button>
            </div>
          )}

          {errorMessage && (
            <div className={`${styles.message} ${styles.error}`} role="alert">
              <span aria-hidden className={styles.msgGlyph}>
                ✕
              </span>
              <p>{errorMessage}</p>
              <button onClick={() => setErrorMessage(null)} aria-label="סגור">
                ✕
              </button>
            </div>
          )}

          {/* Identity score */}
          <section className={styles.scoreCard}>
            <div className={styles.scoreHeader}>
              <h2 className={styles.scoreTitle}>ציון זהות</h2>
              <span className={styles.scoreBadge}>
                {getIdentityLevelLabel(identityScore?.level || 'basic')}
              </span>
            </div>

            <div className={styles.scoreProgress}>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ inlineSize: `${identityScore?.total || 0}%` }}
                  aria-hidden
                />
              </div>
              <span className={styles.scoreValue}>
                {identityScore?.total || 0}/100
              </span>
            </div>

            <p className={styles.scoreDescription}>
              {getIdentityLevelDescription(identityScore?.level || 'basic')}
            </p>

            <dl className={styles.scoreBreakdown}>
              <div className={styles.breakdownItem}>
                <dt>Google</dt>
                <dd>{identityScore?.breakdown?.google || 0} נקודות</dd>
              </div>
              <div className={styles.breakdownItem}>
                <dt>Facebook</dt>
                <dd>{identityScore?.breakdown?.facebook || 0} נקודות</dd>
              </div>
              <div className={styles.breakdownItem}>
                <dt>Instagram</dt>
                <dd>{identityScore?.breakdown?.instagram || 0} נקודות</dd>
              </div>
            </dl>
          </section>

          {/* Connections */}
          <section className={styles.connectionsSection}>
            <h2 className={styles.sectionTitle}>חשבונות מחוברים</h2>

            <ul className={styles.rows}>
              {/* Google — always connected */}
              <li className={`${styles.row} ${styles.connected}`}>
                <div className={styles.rowInfo}>
                  <span className={styles.rowIcon} aria-hidden>
                    G
                  </span>
                  <div className={styles.rowText}>
                    <h3>Google</h3>
                    <p className={styles.rowMeta}>{googleProof?.email || user?.email}</p>
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
              <li className={`${styles.row} ${facebookProof ? styles.connected : ''}`}>
                <div className={styles.rowInfo}>
                  <span className={styles.rowIcon} aria-hidden>
                    f
                  </span>
                  <div className={styles.rowText}>
                    <h3>Facebook</h3>
                    {facebookProof ? (
                      <p className={styles.rowMeta}>
                        {facebookProof.displayName || facebookProof.email}
                      </p>
                    ) : (
                      <p className={styles.rowMeta}>+30 נקודות לציון</p>
                    )}
                  </div>
                </div>
                <div className={styles.rowStatus}>
                  {facebookProof ? (
                    <>
                      <span className={styles.statusOn}>
                        <span aria-hidden>✓ </span>מחובר
                      </span>
                      <span className={styles.points}>+30 נקודות</span>
                      <NewsButton
                        variant="outline"
                        size="sm"
                        onClick={() => handleDisconnect('facebook')}
                        disabled={disconnecting === 'facebook'}
                      >
                        {disconnecting === 'facebook' ? 'מנתק…' : 'נתק'}
                      </NewsButton>
                    </>
                  ) : (
                    <>
                      <span className={styles.statusOff}>
                        <span aria-hidden>○ </span>לא מחובר
                      </span>
                      <NewsButton
                        variant="ink"
                        size="sm"
                        onClick={handleConnectFacebook}
                      >
                        חברו Facebook
                      </NewsButton>
                    </>
                  )}
                </div>
              </li>

              {/* Instagram */}
              <li className={`${styles.row} ${instagramProof ? styles.connected : ''}`}>
                <div className={styles.rowInfo}>
                  <span className={styles.rowIcon} aria-hidden>
                    <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                    </svg>
                  </span>
                  <div className={styles.rowText}>
                    <h3>Instagram</h3>
                    {instagramProof ? (
                      <p className={styles.rowMeta}>@{instagramProof.displayName}</p>
                    ) : (
                      <p className={styles.rowMeta}>+30 נקודות לציון</p>
                    )}
                  </div>
                </div>
                <div className={styles.rowStatus}>
                  {instagramProof ? (
                    <>
                      <span className={styles.statusOn}>
                        <span aria-hidden>✓ </span>מחובר
                      </span>
                      <span className={styles.points}>+30 נקודות</span>
                      <NewsButton
                        variant="outline"
                        size="sm"
                        onClick={() => handleDisconnect('instagram')}
                        disabled={disconnecting === 'instagram'}
                      >
                        {disconnecting === 'instagram' ? 'מנתק…' : 'נתק'}
                      </NewsButton>
                    </>
                  ) : (
                    <>
                      <span className={styles.statusOff}>
                        <span aria-hidden>○ </span>לא מחובר
                      </span>
                      <NewsButton
                        variant="ink"
                        size="sm"
                        onClick={handleConnectInstagram}
                      >
                        חברו Instagram
                      </NewsButton>
                    </>
                  )}
                </div>
              </li>
            </ul>
          </section>

          {/* Info */}
          <section className={styles.infoSection}>
            <h3 className={styles.infoTitle}>למה לחבר רשתות חברתיות?</h3>
            <ul className={styles.infoList}>
              <li>
                <strong>אימות זהות —</strong> כל חשבון מחובר מוסיף שכבת אימות
                נוספת.
              </li>
              <li>
                <strong>ציון גבוה יותר —</strong> ציון זהות גבוה מאפשר השתתפות
                בהצבעות חשובות.
              </li>
              <li>
                <strong>אמינות —</strong> משתמשים עם ציון גבוה נחשבים אמינים יותר
                בקהילה.
              </li>
            </ul>
            <p className={styles.privacyNote}>
              אנחנו לא מפרסמים בשמכם או משתפים את המידע שלכם. החיבור משמש לאימות
              זהות בלבד.
            </p>
          </section>

          <div className={styles.backLink}>
            <NewsButton
              variant="outline"
              size="md"
              onClick={() => router.push('/dashboard')}
              trailing={<span aria-hidden>←</span>}
            >
              חזרה ללוח הבקרה
            </NewsButton>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

// Cast Suspense for React 19 type compatibility
const SuspenseWrapper = Suspense as any;

export default function SocialConnectionsPage() {
  return (
    <SuspenseWrapper
      fallback={
        <div className={styles.loadingContainer}>
          <div className={styles.spinner} aria-hidden />
          <p>טוען…</p>
        </div>
      }
    >
      <SocialConnectionsContent />
    </SuspenseWrapper>
  );
}
