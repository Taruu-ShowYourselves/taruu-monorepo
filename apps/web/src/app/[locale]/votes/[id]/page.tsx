'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { useReducedMotion } from '@/hooks';
import { NewsButton } from '@/components/press/NewsButton';
import { CertificateCard, type Certificate } from '@/components/certificate/CertificateCard';
import { MunicipalityLink } from '@/components/uikit/municipality-link';
import { ParticipationFlow, type FlowOption } from './flow/ParticipationFlow';
import styles from './page.module.css';

interface VoteOption {
  id: string;
  text: string;
  votes: number;
}

interface KnessetContext {
  knessetNum: number | null;
  sessionNumber: number | null;
  sessionDate: string | null;
  ordinal: number | null;
  itemType: string | null;
  isDiscussion: boolean;
  /** AI summary of the attached official document (bill / proposal text). */
  summary?: string | null;
  /** fs.knesset.gov.il link to the original document. */
  docUrl?: string | null;
  /** Document class, e.g. 'הצעת חוק לקריאה הראשונה'. */
  docGroup?: string | null;
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
  /** Present on Knesset-agenda votes - plenum background for the fact sheet. */
  knesset?: KnessetContext;
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    timeZone: 'Asia/Jerusalem',
  }).format(date);
}

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
  const reduced = useReducedMotion();
  const [vote, setVote] = useState<Vote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [myCert, setMyCert] = useState<Certificate | null>(null);

  const fetchVote = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/votes/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        // Contract shape: { vote: { ..., options: [{label/voteCount + text/votes
        // aliases}], userVote?: optionId } } - normalize defensively so a
        // missing alias can never crash the render again.
        const raw = data.vote ?? data;
        setVote({
          ...raw,
          options: (raw.options ?? []).map(
            (o: { id: string; text?: string; label?: string; votes?: number; voteCount?: number }) => ({
              id: o.id,
              text: o.text ?? o.label ?? '',
              votes: o.votes ?? o.voteCount ?? 0,
            })
          ),
          creator: raw.creator ?? { name: '' },
        });
        // Check if user already voted (contract: userVote is the option id)
        const priorOption =
          typeof raw.userVote === 'string' ? raw.userVote : raw.userVote?.optionId;
        if (priorOption) {
          setHasVoted(true);
          setSelectedOption(priorOption);
        }
      } else if (response.status === 404) {
        setError('ההצבעה לא נמצאה');
        setVote(null);
      } else {
        setError('שגיאה בטעינת ההצבעה');
        setVote(null);
      }
    } catch {
      setError('שגיאה בטעינת ההצבעה. בדקו את חיבור האינטרנט.');
      setVote(null);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchVote();
  }, [fetchVote]);

  // Handle payment success redirect - must be before early returns
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

  // Once the vote has ended, surface the signed-in user's certificate for it
  // (auto-issued on resolution; 401/none simply renders nothing).
  useEffect(() => {
    if (!vote || vote.status === 'active') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/user/nfts');
        if (!res.ok) return;
        const data = await res.json();
        const match = ((data.nfts || []) as Certificate[]).find(
          (n) => n.voteId === vote.id
        );
        if (!cancelled && match) setMyCert(match);
      } catch {
        // No certificate to show.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vote]);

  if (loading) {
    return (
      <>
        <Header />
        <main className={styles.main}>
          <div className={styles.container}>
            <div className={styles.skeletonHead}>
              <span className={`${styles.shimmer} ${styles.skBadge}`} />
              <span className={`${styles.shimmer} ${styles.skMeta}`} />
            </div>
            <span className={`${styles.shimmer} ${styles.skTitle}`} />
            <span className={`${styles.shimmer} ${styles.skStats}`} />
            <span className={`${styles.shimmer} ${styles.skCard}`} />
            <span className={`${styles.shimmer} ${styles.skCard}`} />
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (!vote || error) {
    return (
      <>
        <Header />
        <main className={styles.main}>
          <div className={styles.errorContainer}>
            <span className={styles.errorIcon} aria-hidden>
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v5M12 16h.01" strokeLinecap="round" />
              </svg>
            </span>
            <h1>{error || 'ההצבעה לא נמצאה'}</h1>
            <p>לא ניתן לטעון את פרטי ההצבעה</p>
            <NewsButton variant="red" size="lg" onClick={() => router.push('/votes')}>
              חזרה להצבעות
            </NewsButton>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const totalVotes = vote.options.reduce((sum, opt) => sum + opt.votes, 0);
  const timeRemaining = getTimeRemaining(vote.endDate);
  const isActive = vote.status === 'active';
  const flowOptions: FlowOption[] = vote.options.map((o) => ({
    id: o.id,
    text: o.text,
    votes: o.votes,
  }));
  const showFlow = isActive && !hasVoted;
  const showResults = hasVoted || !isActive;

  const handleShare = async () => {
    if (typeof window === 'undefined' || !vote) return;

    const shareUrl = window.location.href;
    const shareData = {
      title: vote.title,
      text: vote.title,
      url: shareUrl,
    };

    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share(shareData);
        return;
      }

      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        alert('הקישור הועתק ללוח');
      }
    } catch (err) {
      // Ignore user-cancelled share dialogs
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('Share error:', err);
    }
  };

  const titleAnim = reduced
    ? {}
    : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } };

  return (
    <>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          {/* Back / dateline bar */}
          <div className={styles.topBar}>
            <button className={styles.backButton} onClick={() => router.back()}>
              <span aria-hidden>↳</span>
              חזרה
            </button>
            <span className={styles.edition}>
              <span className={styles.editionDot} data-status={vote.status} aria-hidden />
              {isActive ? `פעיל · נותרו ${timeRemaining}` : 'ההצבעה הסתיימה'}
            </span>
          </div>

          <div className={styles.ruleHeavy} aria-hidden />

          {/* Article masthead - kicker + headline + standfirst */}
          <header className={styles.head}>
            <span className={styles.kicker}>
              <span aria-hidden className={styles.kickerTick} />
              הצבעה חיה · <MunicipalityLink name={vote.municipality} />
            </span>

            <motion.h1 className={styles.title} {...titleAnim}>
              {vote.title}
            </motion.h1>

            {/* Stats - mono figures */}
            <div className={styles.stats}>
              <div className={styles.stat}>
                <span className={styles.statValue}>{totalVotes.toLocaleString('he-IL')}</span>
                <span className={styles.statLabel}>קולות</span>
              </div>
              <span className={styles.statDivider} aria-hidden />
              <div className={styles.stat}>
                <span className={styles.statValue}>{vote.options.length}</span>
                <span className={styles.statLabel}>אפשרויות</span>
              </div>
              <span className={styles.statDivider} aria-hidden />
              <div className={styles.stat}>
                <span className={styles.statValue}>{timeRemaining}</span>
                <span className={styles.statLabel}>נותרו</span>
              </div>
            </div>
          </header>

          {/* Broadsheet spread: editorial column + participation panel */}
          <div className={styles.spread}>
            {/* Editorial column - description */}
            <article className={styles.story}>
              <span className={styles.colKicker}>ההצעה</span>
              <p className={styles.description}>{vote.description}</p>
              <div className={styles.byline}>
                {vote.creator?.name ? (
                  <>
                    <span>מאת {vote.creator.name}</span>
                    <span className={styles.sep} aria-hidden>■</span>
                  </>
                ) : null}
                <MunicipalityLink name={vote.municipality} />
              </div>

              {/* Document summary - what the attached bill/proposal says */}
              {vote.knesset?.summary ? (
                <section className={styles.docSummary} aria-label="תקציר המסמך">
                  <span className={styles.colKicker}>
                    מה על השולחן · THE DOCUMENT
                  </span>
                  <p className={styles.docSummaryText}>{vote.knesset.summary}</p>
                  <div className={styles.docSummaryMeta}>
                    {vote.knesset.docGroup ? (
                      <span>{vote.knesset.docGroup}</span>
                    ) : null}
                    {vote.knesset.docUrl ? (
                      <a
                        href={vote.knesset.docUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.factLink}
                      >
                        למסמך הרשמי המלא ↗
                      </a>
                    ) : null}
                  </div>
                  <p className={styles.docSummaryNote}>
                    תקציר אוטומטי מתוך המסמך הרשמי - הנוסח המחייב הוא המקור.
                  </p>
                </section>
              ) : null}

              {/* Background fact sheet - plenum context for Knesset votes */}
              {vote.knesset ? (
                <section className={styles.factSheet} aria-label="רקע">
                  <span className={styles.colKicker}>רקע · BACKGROUND</span>
                  <dl className={styles.facts}>
                    <div className={styles.fact}>
                      <dt>מקור</dt>
                      <dd>סדר היום של מליאת הכנסת</dd>
                    </div>
                    {vote.knesset.itemType ? (
                      <div className={styles.fact}>
                        <dt>סוג הסעיף</dt>
                        <dd>
                          {vote.knesset.itemType}
                          {vote.knesset.isDiscussion ? ' · דיון' : ''}
                        </dd>
                      </div>
                    ) : null}
                    {vote.knesset.knessetNum ? (
                      <div className={styles.fact}>
                        <dt>כנסת</dt>
                        <dd>ה-{vote.knesset.knessetNum}</dd>
                      </div>
                    ) : null}
                    {vote.knesset.sessionNumber ? (
                      <div className={styles.fact}>
                        <dt>ישיבת מליאה</dt>
                        <dd>
                          {'מס׳ '}
                          {vote.knesset.sessionNumber}
                          {vote.knesset.sessionDate
                            ? ` · ${formatDate(vote.knesset.sessionDate)}`
                            : ''}
                        </dd>
                      </div>
                    ) : null}
                    {vote.knesset.ordinal ? (
                      <div className={styles.fact}>
                        <dt>מיקום בסדר היום</dt>
                        <dd>סעיף {vote.knesset.ordinal}</dd>
                      </div>
                    ) : null}
                    {!vote.knesset.summary && vote.knesset.docUrl ? (
                      <div className={styles.fact}>
                        <dt>מסמך רשמי</dt>
                        <dd>
                          <a
                            href={vote.knesset.docUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.factLink}
                          >
                            {vote.knesset.docGroup ?? 'למסמך המלא'} ↗
                          </a>
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                  <Link href="/knesset" className={styles.factLink}>
                    לסדר היום המלא של הכנסת ←
                  </Link>
                </section>
              ) : null}

              {/* Context - what this civic vote measures */}
              <section className={styles.contextBox} aria-label="ההקשר">
                <span className={styles.colKicker}>מה מודדים כאן · CONTEXT</span>
                <p className={styles.contextLead}>
                  {vote.knesset
                    ? 'הנושא עומד על סדר יומה של מליאת הכנסת. ההצבעה כאן רצה במקביל להליך הרשמי ומודדת דבר אחד: איפה עומד הרוב האזרחי - כדי שעמדת הציבור תעמוד, שקופה ומאומתת, מול עמדת הבית.'
                    : `הנושא עלה מהשטח. ההצבעה מודדת את עמדת הרוב של התושבים המאומתים, ומייצרת תמונת מצב אחת ברורה שמוגשת לרשות - קשה להתעלם ממספר.`}
                </p>
                <ul className={styles.contextList}>
                  <li>
                    כל קול מאומת בזהות ובמיקום ונספר פעם אחת בלבד — קול אחד
                    לתושב, בלי כפילויות.
                  </li>
                  <li>
                    התוצאות פתוחות לכולם בזמן אמת; בסיום ההצבעה התמונה המלאה
                    נשמרת כרשומה ציבורית קבועה.
                  </li>
                  <li>
                    ההצבעה אינה מחייבת משפטית - היא עמדה אזרחית מדודה, שנועדה
                    לעמוד מול מקבלי ההחלטות.
                  </li>
                </ul>
                <div className={styles.timelineRow}>
                  <span>נפתחה {formatDate(vote.startDate)}</span>
                  <span className={styles.sep} aria-hidden>■</span>
                  <span>
                    {isActive
                      ? `נסגרת ${formatDate(vote.endDate)}`
                      : `נסגרה ${formatDate(vote.endDate)}`}
                  </span>
                </div>
              </section>

              <div className={styles.shareRow}>
                <button className={styles.shareButton} onClick={handleShare}>
                  <span aria-hidden>↗</span>
                  שתפו את ההצבעה
                </button>
              </div>
            </article>

            {/* Participation panel - flow when active, results otherwise */}
            <aside className={styles.panelCol}>
              {showFlow && (
                <ParticipationFlow
                  voteId={String(params.id)}
                  voteTitle={vote.title}
                  options={flowOptions}
                  totalVotes={totalVotes}
                  initialOptionId={selectedOption}
                  onComplete={(optionId: string) => {
                    setSelectedOption(optionId);
                    setHasVoted(true);
                  }}
                />
              )}

              {showResults && (
                <section className={styles.results} aria-label="תוצאות">
                  <header className={styles.resultsHead}>
                    <span className={styles.kicker}>
                      <span aria-hidden className={styles.kickerTick} />
                      תוצאות · RESULTS
                    </span>
                    <span className={styles.place}>
                      {totalVotes.toLocaleString('he-IL')} קולות מאומתים
                    </span>
                  </header>

                  <ul className={styles.options}>
                    {vote.options.map((option, index) => {
                      const percentage =
                        totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
                      const isMine = hasVoted && selectedOption === option.id;
                      return (
                        <li key={option.id}>
                          <div className={`${styles.option} ${isMine ? styles.optionMine : ''}`}>
                            <span className={styles.optionTop}>
                              <span className={styles.mark} aria-hidden>
                                {isMine ? '■' : '□'}
                              </span>
                              <span className={styles.optionLabel}>{option.text}</span>
                              <span className={styles.pct}>{percentage}%</span>
                            </span>
                            <span className={styles.track} aria-hidden>
                              <motion.span
                                className={`${styles.fill} ${isMine ? styles.fillMine : ''}`}
                                initial={reduced ? false : { width: 0 }}
                                whileInView={{ width: `${percentage}%` }}
                                viewport={{ once: true, margin: '-40px' }}
                                transition={{
                                  duration: reduced ? 0 : 0.7,
                                  delay: reduced ? 0 : 0.05 * index,
                                  ease: [0.2, 0, 0, 1],
                                }}
                              />
                            </span>
                            <span className={styles.optionCount}>
                              {option.votes.toLocaleString('he-IL')} קולות
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  {hasVoted && (
                    <div className={styles.votedMessage}>
                      <span className={styles.votedGlyph} aria-hidden>✓</span>
                      הצבעתכם נרשמה ונספרה
                    </div>
                  )}

                  <footer className={styles.resultsMeta}>
                    <span>מאומת · זהות + GPS</span>
                    <span className={styles.sep} aria-hidden>■</span>
                    <span>קול אחד לתושב מאומת</span>
                  </footer>

                  {myCert && (
                    <div className={styles.certBlock}>
                      <span className={styles.certKicker}>
                        <span aria-hidden className={styles.certTick} />
                        התעודה שלכם · YOUR CERTIFICATE
                      </span>
                      <CertificateCard cert={myCert} />
                    </div>
                  )}
                </section>
              )}
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
