'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Heading, Text } from '@/components/ui/Typography';
import styles from './ComingSoon.module.css';

const WHATSAPP_LINK = 'https://chat.whatsapp.com/FITvea9IVsn2Ljie1yCrAc';

interface ComingSoonProps {
  title?: string;
  description?: string;
  showWhatsApp?: boolean;
}

export function ComingSoon({
  title = 'בקרוב',
  description = 'אנחנו עובדים על זה. הצטרפו לקבוצת הוואטסאפ שלנו כדי לקבל עדכונים.',
  showWhatsApp = true,
}: ComingSoonProps) {
  return (
    <section className={styles.comingSoon}>
      <div className={styles.container}>
        <motion.div
          className={styles.content}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className={styles.icon}>🚧</div>
          <Heading level={1} align="center">
            {title}
          </Heading>
          <Text size="xl" color="secondary" align="center" className={styles.description}>
            {description}
          </Text>

          {showWhatsApp && (
            <div className={styles.actions}>
              <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer">
                <Button size="xl">
                  הצטרפו לוואטסאפ הפיילוט
                </Button>
              </a>
              <Link href="/">
                <Button variant="outline" size="xl">
                  חזרה לדף הבית
                </Button>
              </Link>
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
