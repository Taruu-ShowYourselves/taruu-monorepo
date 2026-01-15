'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/Card';
import { Text } from '@/components/ui/Typography';
import { Button } from '@/components/ui/Button';
import { staggerContainer, fadeInUp } from '@/lib/animations';
import styles from './VotesList.module.css';

// Vote types matching API response
interface VoteOption {
  id: string;
  label: string;
  description?: string;
  voteCount: number;
}

interface Vote {
  id: string;
  title: string;
  description: string;
  municipality: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled' | 'ended';
  participantCount: number;
  endDate: string;
  options: VoteOption[];
}

// Fallback mock data for development/error states
const mockVotes: Vote[] = [
  {
    id: '1',
    title: 'שדרוג גינת השכונה ברחוב הרצל',
    description:
      'הצבעה על תוכנית לשדרוג הגינה המרכזית כולל התקנת משחקי ילדים חדשים, ספסלים ותאורה.',
    municipality: 'תל אביב-יפו',
    status: 'active',
    participantCount: 1247,
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    options: [
      { id: '1', label: 'בעד', voteCount: 892 },
      { id: '2', label: 'נגד', voteCount: 355 },
    ],
  },
  {
    id: '2',
    title: 'הקמת מרכז קהילתי חדש',
    description:
      'האם לאשר את בניית מרכז קהילתי חדש באזור הצפוני של העיר?',
    municipality: 'ראשון לציון',
    status: 'active',
    participantCount: 3521,
    endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    options: [
      { id: '1', label: 'בעד', voteCount: 2105 },
      { id: '2', label: 'נגד', voteCount: 1416 },
    ],
  },
  {
    id: '3',
    title: 'שינוי תדירות איסוף אשפה',
    description:
      'הצעה להגדלת תדירות איסוף האשפה משלוש פעמים בשבוע לחמש.',
    municipality: 'חיפה',
    status: 'completed',
    participantCount: 8934,
    endDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    options: [
      { id: '1', label: 'בעד', voteCount: 6721 },
      { id: '2', label: 'נגד', voteCount: 2213 },
    ],
  },
  {
    id: '4',
    title: 'הוספת נתיבי אופניים חדשים',
    description:
      'תוכנית להוספת 15 ק"מ של נתיבי אופניים מוגנים ברחבי העיר.',
    municipality: 'ירושלים',
    status: 'active',
    participantCount: 2156,
    endDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
    options: [
      { id: '1', label: 'בעד', voteCount: 1823 },
      { id: '2', label: 'נגד', voteCount: 333 },
    ],
  },
];

function getStatusLabel(status: string): string {
  switch (status) {
    case 'active':
      return 'פעילה';
    case 'completed':
    case 'ended':
      return 'הסתיימה';
    case 'pending':
      return 'ממתינה';
    case 'cancelled':
      return 'בוטלה';
    default:
      return status;
  }
}

function getTimeRemaining(endDate: string | Date): string {
  const now = new Date();
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  const diff = end.getTime() - now.getTime();

  if (diff < 0) return 'הסתיימה';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) return `${days} ימים`;
  if (hours > 0) return `${hours} שעות`;
  return 'פחות משעה';
}

function isVoteEnded(status: string): boolean {
  return status === 'completed' || status === 'ended' || status === 'cancelled';
}

export function VotesList() {
  const [votes, setVotes] = useState<Vote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUsingMockData, setIsUsingMockData] = useState(false);

  useEffect(() => {
    async function fetchVotes() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch('/api/votes');

        if (!response.ok) {
          throw new Error('Failed to fetch votes');
        }

        const data = await response.json();

        if (data.votes && data.votes.length > 0) {
          setVotes(data.votes);
          setIsUsingMockData(false);
        } else {
          // Use mock data if no votes in database yet
          setVotes(mockVotes);
          setIsUsingMockData(true);
        }
      } catch (err) {
        console.error('Error fetching votes:', err);
        // Fall back to mock data on error
        setVotes(mockVotes);
        setIsUsingMockData(true);
        setError('לא ניתן לטעון את ההצבעות. מציג נתוני הדגמה.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchVotes();
  }, []);

  if (isLoading) {
    return (
      <section className={styles.votesList}>
        <div className={styles.container}>
          <div className={styles.loadingContainer}>
            <div className={styles.spinner} />
            <Text size="lg" color="secondary">טוען הצבעות...</Text>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.votesList}>
      <div className={styles.container}>
        {error && (
          <div className={styles.errorBanner}>
            <Text size="sm" color="secondary">{error}</Text>
          </div>
        )}

        {isUsingMockData && !error && (
          <div className={styles.demoBanner}>
            <Text size="sm" color="secondary">מציג נתוני הדגמה - הצבעות אמיתיות יופיעו בקרוב</Text>
          </div>
        )}

        <motion.div
          className={styles.grid}
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
        >
          {votes.map((vote) => {
            const totalVotes = vote.options.reduce((sum, opt) => sum + opt.voteCount, 0);
            const leadingOption = vote.options.reduce((a, b) =>
              a.voteCount > b.voteCount ? a : b
            );
            const leadingPercentage = totalVotes > 0
              ? Math.round((leadingOption.voteCount / totalVotes) * 100)
              : 0;

            return (
              <motion.div key={vote.id} variants={fadeInUp}>
                <Card variant="default" padding="lg" interactive>
                  <CardContent>
                    <div className={styles.cardHeader}>
                      <span
                        className={`${styles.statusBadge} ${styles[vote.status]}`}
                      >
                        {getStatusLabel(vote.status)}
                      </span>
                      <span className={styles.municipality}>
                        {vote.municipality}
                      </span>
                    </div>

                    <h3 className={styles.voteTitle}>{vote.title}</h3>

                    <Text size="sm" color="secondary" className={styles.description}>
                      {vote.description}
                    </Text>

                    {/* Progress Bar */}
                    <div className={styles.progress}>
                      <div className={styles.progressBar}>
                        <div
                          className={styles.progressFill}
                          style={{ width: `${leadingPercentage}%` }}
                        />
                      </div>
                      <div className={styles.progressLabels}>
                        <span>{leadingOption.label}: {leadingPercentage}%</span>
                        <span>{totalVotes.toLocaleString('he-IL')} הצבעות</span>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className={styles.cardFooter}>
                      <div className={styles.timeRemaining}>
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <path d="M12 6v6l4 2" />
                        </svg>
                        <span>
                          {isVoteEnded(vote.status)
                            ? 'הסתיימה'
                            : getTimeRemaining(vote.endDate)}
                        </span>
                      </div>

                      <Link href={`/votes/${vote.id}`}>
                        <Button variant="ghost" size="sm">
                          {!isVoteEnded(vote.status) ? 'הצביעו' : 'צפו בתוצאות'}
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Load More */}
        <div className={styles.loadMore}>
          <Button variant="outline" size="lg">
            טענו עוד הצבעות
          </Button>
        </div>
      </div>
    </section>
  );
}
