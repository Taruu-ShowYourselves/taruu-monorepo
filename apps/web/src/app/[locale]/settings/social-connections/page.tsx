'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/Button';
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

export default function SocialConnectionsPage() {
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
        <div className={styles.spinner} />
        <p>טוען...</p>
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
          <motion.div
            className={styles.header}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1>חיבור רשתות חברתיות</h1>
            <p>
              חברו את הרשתות החברתיות שלכם כדי להגדיל את ציון הזהות ולקבל גישה מלאה לפלטפורמה
            </p>
          </motion.div>

          {/* Messages */}
          {successMessage && (
            <motion.div
              className={styles.successMessage}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
            >
              {successMessage}
              <button onClick={() => setSuccessMessage(null)}>×</button>
            </motion.div>
          )}

          {errorMessage && (
            <motion.div
              className={styles.errorMessage}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
            >
              {errorMessage}
              <button onClick={() => setErrorMessage(null)}>×</button>
            </motion.div>
          )}

          {/* Identity Score Card */}
          <motion.div
            className={styles.scoreCard}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className={styles.scoreHeader}>
              <h2>ציון זהות</h2>
              <span className={`${styles.badge} ${styles[identityScore?.level || 'basic']}`}>
                {getIdentityLevelLabel(identityScore?.level || 'basic')}
              </span>
            </div>

            <div className={styles.scoreProgress}>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${identityScore?.total || 0}%` }}
                />
              </div>
              <span className={styles.scoreValue}>{identityScore?.total || 0}/100</span>
            </div>

            <p className={styles.scoreDescription}>
              {getIdentityLevelDescription(identityScore?.level || 'basic')}
            </p>

            <div className={styles.scoreBreakdown}>
              <div className={styles.breakdownItem}>
                <span>Google</span>
                <span>{identityScore?.breakdown?.google || 0} נקודות</span>
              </div>
              <div className={styles.breakdownItem}>
                <span>Facebook</span>
                <span>{identityScore?.breakdown?.facebook || 0} נקודות</span>
              </div>
              <div className={styles.breakdownItem}>
                <span>Instagram</span>
                <span>{identityScore?.breakdown?.instagram || 0} נקודות</span>
              </div>
            </div>
          </motion.div>

          {/* Social Connections */}
          <motion.div
            className={styles.connectionsSection}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <h2>חשבונות מחוברים</h2>

            {/* Google - Always connected */}
            <div className={`${styles.connectionCard} ${styles.connected}`}>
              <div className={styles.connectionInfo}>
                <span className={styles.connectionIcon}>G</span>
                <div>
                  <h3>Google</h3>
                  <p>{googleProof?.email || user?.email}</p>
                </div>
              </div>
              <div className={styles.connectionStatus}>
                <span className={styles.connectedBadge}>מחובר</span>
                <span className={styles.points}>+40 נקודות</span>
              </div>
            </div>

            {/* Facebook */}
            <div className={`${styles.connectionCard} ${facebookProof ? styles.connected : ''}`}>
              <div className={styles.connectionInfo}>
                <span className={styles.connectionIcon}>f</span>
                <div>
                  <h3>Facebook</h3>
                  {facebookProof ? (
                    <p>{facebookProof.displayName || facebookProof.email}</p>
                  ) : (
                    <p>חברו את Facebook להוספת 30 נקודות</p>
                  )}
                </div>
              </div>
              <div className={styles.connectionActions}>
                {facebookProof ? (
                  <>
                    <span className={styles.connectedBadge}>מחובר</span>
                    <span className={styles.points}>+30 נקודות</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDisconnect('facebook')}
                      isLoading={disconnecting === 'facebook'}
                    >
                      נתק
                    </Button>
                  </>
                ) : (
                  <Button onClick={handleConnectFacebook}>
                    חבר Facebook
                  </Button>
                )}
              </div>
            </div>

            {/* Instagram */}
            <div className={`${styles.connectionCard} ${instagramProof ? styles.connected : ''}`}>
              <div className={styles.connectionInfo}>
                <span className={styles.connectionIcon}>📷</span>
                <div>
                  <h3>Instagram</h3>
                  {instagramProof ? (
                    <p>@{instagramProof.displayName}</p>
                  ) : (
                    <p>חברו את Instagram להוספת 30 נקודות</p>
                  )}
                </div>
              </div>
              <div className={styles.connectionActions}>
                {instagramProof ? (
                  <>
                    <span className={styles.connectedBadge}>מחובר</span>
                    <span className={styles.points}>+30 נקודות</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDisconnect('instagram')}
                      isLoading={disconnecting === 'instagram'}
                    >
                      נתק
                    </Button>
                  </>
                ) : (
                  <Button onClick={handleConnectInstagram}>
                    חבר Instagram
                  </Button>
                )}
              </div>
            </div>
          </motion.div>

          {/* Info Section */}
          <motion.div
            className={styles.infoSection}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <h3>למה לחבר רשתות חברתיות?</h3>
            <ul>
              <li>
                <strong>אימות זהות:</strong> כל חשבון מחובר מוסיף שכבת אימות נוספת
              </li>
              <li>
                <strong>ציון גבוה יותר:</strong> ציון זהות גבוה מאפשר השתתפות בהצבעות חשובות
              </li>
              <li>
                <strong>אמינות:</strong> משתמשים עם ציון גבוה נחשבים אמינים יותר בקהילה
              </li>
            </ul>
            <p className={styles.privacyNote}>
              אנחנו לא מפרסמים בשמכם או משתפים את המידע שלכם. החיבור משמש לאימות זהות בלבד.
            </p>
          </motion.div>

          <div className={styles.backLink}>
            <Button variant="ghost" onClick={() => router.push('/dashboard')}>
              חזרה ללוח הבקרה
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
