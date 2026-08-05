'use client';

import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { NewsButton } from '@/components/press';
import styles from './page.module.css';

/**
 * Green Invoice returns the buyer here after checkout.
 *
 * This page is a plain acknowledgement and knows nothing about proposals.
 * Raising a proposal is free and no longer passes through a checkout at all
 * (issue #75): the ₪50 creation fee is an obligation created when a space admin
 * approves, so there is no draft to finalise on the way back, no state to hold
 * and no effect to run. What still lands here is a participation purchase.
 *
 * Known gap, deliberately left alone: Green Invoice appends `?status=failed` to
 * its failure URL and this page has never read it, so a declined participation
 * payment sees the acknowledgement below. Fixing that is a real improvement to
 * the participation flow and belongs with it, not here.
 */
export default function PaymentReturnPage() {
  const router = useRouter();

  return (
    <>
      <Header />
      <main className={styles.page}>
        <div className={styles.inner}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            התקבל · RECEIVED
          </span>
          <h1 className={styles.headline}>
            התשלום <span className={styles.red}>התקבל.</span>
          </h1>
          <p className={styles.standfirst}>תודה. אפשר להמשיך מהלוח האישי.</p>

          <div className={styles.actions}>
            <NewsButton variant="red" size="lg" onClick={() => router.push('/dashboard')}>
              ללוח שלי
            </NewsButton>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
