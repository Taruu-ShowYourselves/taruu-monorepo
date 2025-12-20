'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/Card';
import { Text } from '@/components/ui/Typography';
import { Button } from '@/components/ui/Button';
import { staggerContainer, fadeInUp } from '@/lib/animations';
import styles from './VotesList.module.css';

// Mock data for demonstration
const mockVotes = [
  {
    id: '1',
    title: 'שדרוג גינת השכונה ברחוב הרצל',
    description:
      'הצבעה על תוכנית לשדרוג הגינה המרכזית כולל התקנת משחקי ילדים חדשים, ספסלים ותאורה.',
    municipality: 'תל אביב-יפו',
    status: 'active' as const,
    participantCount: 1247,
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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
    status: 'active' as const,
    participantCount: 3521,
    endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
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
    status: 'completed' as const,
    participantCount: 8934,
    endDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
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
    status: 'active' as const,
    participantCount: 2156,
    endDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
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
      return 'הסתיימה';
    case 'pending':
      return 'ממתינה';
    default:
      return status;
  }
}

function getTimeRemaining(endDate: Date): string {
  const now = new Date();
  const diff = endDate.getTime() - now.getTime();

  if (diff < 0) return 'הסתיימה';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) return `${days} ימים`;
  if (hours > 0) return `${hours} שעות`;
  return 'פחות משעה';
}

export function VotesList() {
  return (
    <section className={styles.votesList}>
      <div className={styles.container}>
        <motion.div
          className={styles.grid}
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
        >
          {mockVotes.map((vote) => {
            const totalVotes = vote.options.reduce((sum, opt) => sum + opt.voteCount, 0);
            const leadingOption = vote.options.reduce((a, b) =>
              a.voteCount > b.voteCount ? a : b
            );
            const leadingPercentage = Math.round(
              (leadingOption.voteCount / totalVotes) * 100
            );

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
                          {vote.status === 'completed'
                            ? 'הסתיימה'
                            : getTimeRemaining(vote.endDate)}
                        </span>
                      </div>

                      <Link href={`/votes/${vote.id}`}>
                        <Button variant="ghost" size="sm">
                          {vote.status === 'active' ? 'הצביעו' : 'צפו בתוצאות'}
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
