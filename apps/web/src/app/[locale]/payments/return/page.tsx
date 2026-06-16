'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { NewsButton } from '@/components/press';
import styles from './page.module.css';

interface PendingVote {
  title: string;
  description: string;
  options: string[];
  duration: number;
  paymentId?: string;
  orderId?: string;
}

type Phase = 'finalising' | 'created' | 'processing' | 'received' | 'error';

const SLEEP = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Paddle returns the buyer here after checkout. For a vote-creation payment we
 * finalise the vote (the draft was stashed in sessionStorage before redirect);
 * the server re-verifies the payment, so a stale draft can never publish for
 * free. Any other payment that lands here gets a plain acknowledgement.
 */
export default function PaymentReturnPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('finalising');
  const [voteId, setVoteId] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const raw = sessionStorage.getItem('pendingVote');
    if (!raw) {
      // Not a vote-creation return — just acknowledge the payment.
      setPhase('received');
      return;
    }

    let draft: PendingVote;
    try {
      draft = JSON.parse(raw) as PendingVote;
    } catch {
      setPhase('error');
      return;
    }

    const now = new Date();
    const end = new Date(now.getTime() + draft.duration * 24 * 60 * 60 * 1000);
    const payload = {
      title: draft.title,
      description: draft.description,
      options: draft.options.map((label) => ({ label })),
      startDate: now.toISOString(),
      endDate: end.toISOString(),
      paymentTxId: draft.paymentId,
    };

    (async () => {
      // The payment webhook may land a beat after the buyer returns, so a 402
      // (payment-not-yet-completed) is retried a few times before giving up.
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const res = await fetch('/api/votes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (res.ok) {
            const data = await res.json();
            sessionStorage.removeItem('pendingVote');
            setVoteId(data.vote?.id ?? null);
            setPhase('created');
            return;
          }
          if (res.status === 402 && attempt < 3) {
            await SLEEP(2000);
            continue;
          }
          // 402 = payment still settling; 400 = payment already consumed, which
          // most often means a prior attempt already created the vote (e.g. a
          // network blip after the server committed). Neither is a hard error —
          // send the user to their dashboard to find the vote.
          setPhase(res.status === 402 || res.status === 400 ? 'processing' : 'error');
          return;
        } catch {
          if (attempt < 3) {
            await SLEEP(2000);
            continue;
          }
          setPhase('error');
          return;
        }
      }
    })();
  }, []);

  const COPY: Record<Phase, { kicker: string; title: React.ReactNode; body: string }> = {
    finalising: {
      kicker: 'מעבדים · PROCESSING',
      title: <>רושמים את ההצבעה<span className={styles.red}>…</span></>,
      body: 'התשלום התקבל. אנחנו מפרסמים את הנושא שלכם — רגע אחד.',
    },
    created: {
      kicker: 'פורסם · PUBLISHED',
      title: <>ההצבעה <span className={styles.red}>עלתה לאוויר.</span></>,
      body: 'הנושא שלכם פתוח עכשיו לתושבי הרשות. שתפו אותו כדי לאסוף קולות.',
    },
    processing: {
      kicker: 'כמעט שם · PENDING',
      title: <>מאמתים את <span className={styles.red}>התשלום.</span></>,
      body: 'התשלום עדיין נחתם. ההצבעה תפורסם תוך רגעים — אפשר לבדוק בלוח שלי.',
    },
    received: {
      kicker: 'התקבל · RECEIVED',
      title: <>התשלום <span className={styles.red}>התקבל.</span></>,
      body: 'תודה. אפשר להמשיך מהלוח האישי.',
    },
    error: {
      kicker: 'תקלה · ERROR',
      title: <>משהו <span className={styles.red}>השתבש.</span></>,
      body: 'לא הצלחנו לסיים את הרישום. אם חויבתם, פנו אלינו ונסדר — לא תחויבו פעמיים.',
    },
  };

  const c = COPY[phase];
  const busy = phase === 'finalising';

  return (
    <>
      <Header />
      <main className={styles.page}>
        <div className={styles.inner}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            {c.kicker}
          </span>
          <h1 className={styles.headline}>{c.title}</h1>
          <p className={styles.standfirst}>{c.body}</p>

          {busy && <div className={styles.bar} aria-hidden />}

          <div className={styles.actions}>
            {phase === 'created' && (
              <NewsButton
                variant="red"
                size="lg"
                onClick={() => router.push(voteId ? `/votes/${voteId}` : '/votes')}
              >
                {voteId ? 'לצפייה בהצבעה' : 'לכל ההצבעות'}
              </NewsButton>
            )}
            {(phase === 'processing' || phase === 'received') && (
              <NewsButton variant="red" size="lg" onClick={() => router.push('/dashboard')}>
                ללוח שלי
              </NewsButton>
            )}
            {phase === 'error' && (
              <>
                <NewsButton variant="ink" size="md" onClick={() => router.push('/votes/create')}>
                  לניסיון נוסף
                </NewsButton>
                <NewsButton variant="red" size="md" onClick={() => router.push('/support')}>
                  לפנייה לתמיכה
                </NewsButton>
              </>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
