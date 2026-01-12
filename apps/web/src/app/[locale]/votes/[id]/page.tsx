'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/Button';
import styles from './page.module.css';
import { useAuthStore } from '@/stores/authStore';

interface VoteOption {
  id: string;
  text: string;
  votes: number;
}

interface Vote {
  id: string;
  title: string;
  description: string;
  municipality: string;
  status: 'active' | 'ended' | 'pending';
  options: VoteOption[];
  startDate: string;
  endDate: string;
  participantCount: number;
  creator: {
    name: string;
  };
}

// Mock data - will be replaced with API call
const mockVote: Vote = {
  id: '1',
  title: 'הקמת גן שעשועים חדש ברובע הצפוני',
  description: `הצעה להקמת גן שעשועים חדש ומודרני ברובע הצפוני של העיר. הגן יכלול:

• מתקני משחק לגילאי 3-12
• אזור ישיבה מוצל להורים
• מזרקת מים לקיץ
• משטחי בטיחות מגומי
• נגישות מלאה לבעלי מוגבלויות

התקציב המשוער: 2.5 מיליון ש"ח מתקציב הפיתוח העירוני.`,
  municipality: 'תל אביב-יפו',
  status: 'active',
  options: [
    { id: '1', text: 'בעד - יש צורך בגן שעשועים נוסף', votes: 847 },
    { id: '2', text: 'נגד - יש מספיק גנים באזור', votes: 234 },
    { id: '3', text: 'בעד עם שינויים - רוצה לראות תכנון מפורט', votes: 156 },
  ],
  startDate: '2024-12-15T00:00:00Z',
  endDate: '2024-12-29T23:59:59Z',
  participantCount: 1237,
  creator: {
    name: 'מועצת הרובע הצפוני',
  },
};

function getTimeRemaining(endDate: string): string {
  const end = new Date(endDate);
  const now = new Date();
  const diff = end.getTime() - now.getTime();

  if (diff <= 0) return 'הסתיים';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) return `${days} ימים`;
  return `${hours} שעות`;
}

export default function VoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [vote, setVote] = useState<Vote | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);

  const fetchVote = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/votes/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        setVote(data);
        // Check if user already voted
        if (data.userVote) {
          setHasVoted(true);
          setSelectedOption(data.userVote.optionId);
        }
      } else {
        // Fallback to mock data for demo
        setVote(mockVote);
      }
    } catch {
      // Use mock data as fallback
      setVote(mockVote);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchVote();
  }, [fetchVote]);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <p>טוען...</p>
      </div>
    );
  }

  if (!vote) {
    return (
      <div className={styles.errorContainer}>
        <h1>ההצבעה לא נמצאה</h1>
        <Button onClick={() => router.push('/votes')}>חזרה להצבעות</Button>
      </div>
    );
  }

  const totalVotes = vote.options.reduce((sum, opt) => sum + opt.votes, 0);
  const timeRemaining = getTimeRemaining(vote.endDate);
  const isActive = vote.status === 'active';

  const handleVote = async () => {
    if (!selectedOption || !vote) return;

    // Check if user is authenticated
    if (!isAuthenticated) {
      router.push('/sign-in?redirect=' + encodeURIComponent(`/votes/${params.id}`));
      return;
    }

    setSubmitting(true);
    try {
      // Create Green Invoice payment
      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'vote_participation',
          voteId: params.id,
          optionId: selectedOption,
          voteTitle: vote.title,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create payment');
      }

      const data = await response.json();

      // Redirect to Green Invoice payment page
      if (data.payment?.paymentUrl) {
        window.location.href = data.payment.paymentUrl;
      } else {
        throw new Error('No payment URL received');
      }
    } catch (err: any) {
      console.error('Payment error:', err);
      alert(err.message || 'שגיאה בתשלום');
      setSubmitting(false);
    }
  };

  // Handle payment success redirect
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('payment') === 'success') {
      setHasVoted(true);
      // Clean up URL
      router.replace(`/votes/${params.id}`);
      // Refresh vote data
      fetchVote();
    }
  }, [params.id, router, fetchVote]);

  return (
    <>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          {/* Back Button */}
          <button className={styles.backButton} onClick={() => router.back()}>
            <span className={styles.backArrow}>←</span>
            חזרה
          </button>

          {/* Vote Header */}
          <motion.div
            className={styles.header}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className={styles.statusBadge} data-status={vote.status}>
              {isActive ? `נותרו ${timeRemaining}` : 'ההצבעה הסתיימה'}
            </div>
            <span className={styles.municipality}>{vote.municipality}</span>
          </motion.div>

          <motion.h1
            className={styles.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            {vote.title}
          </motion.h1>

          {/* Stats */}
          <motion.div
            className={styles.stats}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className={styles.stat}>
              <span className={styles.statValue}>{totalVotes.toLocaleString('he-IL')}</span>
              <span className={styles.statLabel}>הצבעות</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statValue}>{vote.options.length}</span>
              <span className={styles.statLabel}>אפשרויות</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statValue}>{timeRemaining}</span>
              <span className={styles.statLabel}>נותרו</span>
            </div>
          </motion.div>

          <div className={styles.content}>
            {/* Description */}
            <motion.div
              className={styles.descriptionCard}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <h2>תיאור ההצעה</h2>
              <p className={styles.description}>{vote.description}</p>
              <div className={styles.creator}>
                <span>נוצר על ידי:</span>
                <strong>{vote.creator.name}</strong>
              </div>
            </motion.div>

            {/* Options */}
            <motion.div
              className={styles.optionsCard}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <h2>{hasVoted ? 'תוצאות' : 'אפשרויות להצבעה'}</h2>

              <div className={styles.options}>
                {vote.options.map((option, index) => {
                  const percentage = totalVotes > 0
                    ? Math.round((option.votes / totalVotes) * 100)
                    : 0;
                  const isSelected = selectedOption === option.id;

                  return (
                    <motion.button
                      key={option.id}
                      className={`${styles.option} ${isSelected ? styles.selected : ''} ${hasVoted ? styles.voted : ''}`}
                      onClick={() => !hasVoted && setSelectedOption(option.id)}
                      disabled={hasVoted || !isActive}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.5 + index * 0.1 }}
                    >
                      <div className={styles.optionContent}>
                        <span className={styles.optionText}>{option.text}</span>
                        {(hasVoted || !isActive) && (
                          <span className={styles.optionVotes}>
                            {option.votes.toLocaleString('he-IL')} הצבעות
                          </span>
                        )}
                      </div>
                      {(hasVoted || !isActive) && (
                        <div className={styles.optionBar}>
                          <motion.div
                            className={styles.optionProgress}
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 0.8, delay: 0.6 + index * 0.1 }}
                          />
                        </div>
                      )}
                      {(hasVoted || !isActive) && (
                        <span className={styles.optionPercentage}>{percentage}%</span>
                      )}
                      {isSelected && !hasVoted && (
                        <span className={styles.checkmark}>✓</span>
                      )}
                    </motion.button>
                  );
                })}
              </div>

              {isActive && !hasVoted && (
                <div className={styles.voteAction}>
                  <p className={styles.voteInfo}>
                    עלות הצבעה: <strong>₪3</strong> • נרשם בבלוקצ׳יין
                  </p>
                  <Button
                    onClick={handleVote}
                    disabled={!selectedOption || submitting}
                    size="large"
                  >
                    {submitting ? 'מעבד תשלום...' : 'הצביעו עכשיו'}
                  </Button>
                </div>
              )}

              {hasVoted && (
                <div className={styles.votedMessage}>
                  <span className={styles.votedIcon}>✓</span>
                  הצבעתכם נקלטה בהצלחה
                </div>
              )}
            </motion.div>
          </div>

          {/* Share */}
          <motion.div
            className={styles.shareSection}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.7 }}
          >
            <button className={styles.shareButton}>
              שתפו את ההצבעה
            </button>
          </motion.div>
        </div>
      </main>
      <Footer />
    </>
  );
}
