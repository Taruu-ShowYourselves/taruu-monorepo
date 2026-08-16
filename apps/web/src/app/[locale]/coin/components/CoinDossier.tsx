'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { NewsButton, SealCard } from '@/components/press';
import { MunicipalityLink } from '@/components/uikit/municipality-link';
import type { Locale } from '@/lib/i18n';
import { WHATSAPP_LINK, formatCurrency, formatNumber } from './format';
import styles from '../[id]/page.module.css';
import { localePrefix } from '@/lib/i18n';

interface IssueCoin {
  id: string;
  voteId: string;
  tokenMint: string | null;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimals?: number;
  totalSupply: string | null;
  totalPurchased: string | null;
  /** Stored in agorot - divide by 100 for ILS. */
  totalValueILS: number;
  tradingEnabled: boolean;
  isFrozen: boolean;
  launchTxHash?: string | null;
  holderCount: number;
  createdAt?: string;
}

interface Holder {
  id: string;
  displayName: string;
  walletAddress?: string | null;
  tokenAmount: string;
  /** Stored in agorot - divide by 100 for ILS. */
  investedILS: number;
  isLocalResident: boolean;
}

interface VoteInfo {
  title?: string;
  municipality?: string;
  status?: string;
}

interface CoinDossierProps {
  voteId: string;
  locale?: Locale;
}

interface CoinDossierCopy {
  statusLabels: Record<string, string>;
  loadError: string;
  loadingLabel: string;
  emptyTitle: string;
  emptyText: string;
  emptyMarketCta: string;
  foundersCta: string;
  crumb: string;
  kicker: string;
  tradeLive: string;
  tradeFrozen: string;
  statRaised: string;
  statHolders: string;
  statSupply: string;
  statPurchased: string;
  backKicker: string;
  backLine1: string;
  backStrong: string;
  backLine2: string;
  backNote: string;
  backCta: string;
  backFrozen: string;
  backNotOpen: string;
  mintTitle: string;
  sealSupply: string;
  sealHolders: string;
  sealStatus: string;
  sealTrading: string;
  sealFrozen: string;
  noMint: string;
  explainerTitle: string;
  explainerText: string;
  voteCta: string;
  economicsLink: string;
  ledgerTitle: string;
  ledgerEmpty: string;
  colHolder: string;
  colAmount: string;
  colInvested: string;
  residentTag: string;
  externalTag: string;
  arrow: string;
}

const COPY: Record<Locale, CoinDossierCopy> = {
  he: {
    statusLabels: {
      active: 'פעילה',
      ended: 'הסתיימה',
      resolving: 'בהכרעה',
      resolved: 'הוכרעה',
      draft: 'טיוטה',
    },
    loadError: 'לא הצלחנו לטעון את תיק ה-BAG כרגע.',
    loadingLabel: 'טוען',
    emptyTitle: 'אין BAG להצבעה הזו.',
    emptyText:
      'ייתכן שההצבעה עדיין לא פתחה BAG ב-bags.fm, או שהמזהה שגוי. חזרו לשוק או הצטרפו לפיילוט.',
    emptyMarketCta: '← לשוק ה-BAGS',
    foundersCta: 'קבוצת המייסדים',
    crumb: '← שוק ה-BAGS',
    kicker: 'מטבע ההצבעה · BAGS.FM',
    tradeLive: '● נסחר',
    tradeFrozen: '□ קפוא',
    statRaised: 'גויס · ₪',
    statHolders: 'מחזיקים',
    statSupply: 'היצע כולל',
    statPurchased: 'נרכש',
    backKicker: 'גבו את ההחלטה · BACK',
    backLine1: 'כל אחד יכול לגבות את ה-BAG, תושב או מבחוץ.',
    backStrong: 'ההצבעה שמורה לתושבים מאומתים; הגיבוי הכלכלי פתוח לכולם.',
    backLine2: 'ככל שה-BAG גדל, לביצוע החלטת הרוב יש יותר משאבים אמיתיים מאחוריו.',
    backNote: 'המסחר רץ על bags.fm: מסילות כסף עצמאיות על בלוקצ׳יין ציבורי, מחוץ לפלטפורמה.',
    backCta: 'גבו ב-bags.fm',
    backFrozen: 'המסחר ב-BAG קפוא כרגע.',
    backNotOpen: 'ה-BAG עדיין לא נפתח למסחר.',
    mintTitle: 'הטבעה על השרשרת',
    sealSupply: 'היצע',
    sealHolders: 'מחזיקים',
    sealStatus: 'מצב',
    sealTrading: 'נסחר',
    sealFrozen: 'קפוא',
    noMint: 'טרם נרשמה כתובת הטבעה על השרשרת.',
    explainerTitle: 'איך זה עובד',
    explainerText:
      'לכל הצבעה נפתח BAG משלה ב-bags.fm: מטבע ממים מבוסס בלוקצ׳יין, ממותג סביב הפלטפורמה. תושבים מקומיים ואנשים מבחוץ קונים את ה-BAG ומשקיעים בתנועה הכלכלית של ההצבעה, בדיוק כמו במניה, כדי לתמוך בביצוע החלטת הרוב. ה-BAG שקוף, סחיר, וחתום בבלוקצ׳יין: ככל שהוא גדל, לנושא יש יותר משאבים אמיתיים מאחוריו.',
    voteCta: 'להצבעה שמאחורי ה-BAG',
    economicsLink: 'איך הכלכלה עובדת ←',
    ledgerTitle: 'פנקס המחזיקים',
    ledgerEmpty: 'עדיין אין מחזיקים רשומים ל-BAG הזה.',
    colHolder: 'מחזיק',
    colAmount: 'כמות',
    colInvested: 'הושקע · ₪',
    residentTag: 'תושב מאומת',
    externalTag: 'חיצוני',
    arrow: '←',
  },
  en: {
    statusLabels: {
      active: 'Active',
      ended: 'Ended',
      resolving: 'Being resolved',
      resolved: 'Resolved',
      draft: 'Draft',
    },
    loadError: 'We could not load the BAG dossier right now.',
    loadingLabel: 'Loading',
    emptyTitle: 'No BAG for this vote.',
    emptyText:
      'The vote may not have opened a BAG on bags.fm yet, or the ID is wrong. Return to the market or join the pilot.',
    emptyMarketCta: '→ To the BAGS market',
    foundersCta: 'The founders’ group',
    crumb: '→ The BAGS market',
    kicker: 'The vote’s coin · BAGS.FM',
    tradeLive: '● Trading',
    tradeFrozen: '□ Frozen',
    statRaised: 'Raised · ₪',
    statHolders: 'Holders',
    statSupply: 'Total supply',
    statPurchased: 'Purchased',
    backKicker: 'Back the decision · BACK',
    backLine1: 'Anyone can back the BAG, resident or outsider.',
    backStrong: 'The vote is reserved for verified residents; the financial backing is open to all.',
    backLine2: 'As the BAG grows, the execution of the majority’s decision has more real resources behind it.',
    backNote: 'Trading runs on bags.fm: independent money rails on a public blockchain, outside the platform.',
    backCta: 'Back it on bags.fm',
    backFrozen: 'Trading in this BAG is currently frozen.',
    backNotOpen: 'The BAG has not yet opened for trading.',
    mintTitle: 'The on-chain mint',
    sealSupply: 'Supply',
    sealHolders: 'Holders',
    sealStatus: 'Status',
    sealTrading: 'Trading',
    sealFrozen: 'Frozen',
    noMint: 'No on-chain mint address has been recorded yet.',
    explainerTitle: 'How it works',
    explainerText:
      'Every vote opens a BAG of its own on bags.fm: a blockchain-based meme coin, branded around the platform. Local residents and outsiders buy the BAG and invest in the vote’s economic momentum, just like a share, to support the execution of the majority’s decision. The BAG is transparent, tradable and sealed on the blockchain: as it grows, the issue has more real resources behind it.',
    voteCta: 'To the vote behind the BAG',
    economicsLink: 'How the economics work →',
    ledgerTitle: 'The holders’ ledger',
    ledgerEmpty: 'No holders are registered for this BAG yet.',
    colHolder: 'Holder',
    colAmount: 'Amount',
    colInvested: 'Invested · ₪',
    residentTag: 'Verified resident',
    externalTag: 'External',
    arrow: '→',
  },
};

const toILS = (agorot: number): number => (Number.isFinite(agorot) ? agorot / 100 : 0);

export function CoinDossier({ voteId, locale = 'he' }: CoinDossierProps) {
  const t = COPY[locale];
  const [coin, setCoin] = useState<IssueCoin | null>(null);
  const [vote, setVote] = useState<VoteInfo | null>(null);
  const [holders, setHolders] = useState<Holder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [coinRes, holdersRes, voteRes] = await Promise.all([
          fetch(`/api/votes/${voteId}/issue-coin`),
          fetch(`/api/votes/${voteId}/issue-coin/holders?limit=100`),
          fetch(`/api/votes/${voteId}`),
        ]);

        if (cancelled) return;

        if (coinRes.ok) {
          const data = await coinRes.json();
          if (!data.issueCoin) {
            setNotFound(true);
          } else {
            setCoin(data.issueCoin);
          }
        } else {
          setNotFound(true);
        }

        if (holdersRes.ok) {
          const data = await holdersRes.json();
          if (!cancelled) setHolders(Array.isArray(data.holders) ? data.holders : []);
        }

        if (voteRes.ok) {
          const data = await voteRes.json();
          const v = data?.vote ?? data;
          if (!cancelled && v) {
            setVote({
              title: v.title,
              municipality: v.municipality ?? v.municipalityId ?? v.municipality_id,
              status: v.status,
            });
          }
        }
      } catch {
        if (!cancelled) setError(t.loadError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [voteId, t.loadError]);

  if (loading) return <DossierSkeleton locale={locale} />;

  if (error) {
    return (
      <section className={styles.page}>
        <DossierNotice message={error} />
        <BackLink locale={locale} />
      </section>
    );
  }

  if (notFound || !coin) {
    return (
      <section className={styles.page}>
        <div className={styles.empty}>
          <span className={styles.emptyGlyph} aria-hidden>
            ▍
          </span>
          <h2 className={styles.emptyTitle}>{t.emptyTitle}</h2>
          <p className={styles.emptyText}>
            {t.emptyText}
          </p>
          <div className={styles.emptyActions}>
            <NewsButton href={`${localePrefix(locale)}/coin`} variant="ink" size="md">
              {t.emptyMarketCta}
            </NewsButton>
            <NewsButton
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              variant="red"
              size="md"
              trailing={<span aria-hidden>{t.arrow}</span>}
            >
              {t.foundersCta}
            </NewsButton>
          </div>
        </div>
      </section>
    );
  }

  const raisedILS = toILS(coin.totalValueILS);
  const live = coin.tradingEnabled && !coin.isFrozen;
  const statusLabel = vote?.status ? t.statusLabels[vote.status] ?? vote.status : '-';

  return (
    <section className={styles.page}>
      {/* Header */}
      <header className={styles.head}>
        <Link className={styles.crumb} href={`${localePrefix(locale)}/coin`}>
          {t.crumb}
        </Link>
        <span className={styles.kicker}>
          <span aria-hidden className={styles.kickerTick} />
          {t.kicker}
        </span>
        <h1 className={styles.headline}>
          {coin.tokenName} <span className={styles.symbol}>{coin.tokenSymbol}</span>
        </h1>
        <div className={styles.subline}>
          <span className={styles.subTitle}>{vote?.title ?? '-'}</span>
          <span className={styles.subMeta}>
            <MunicipalityLink name={vote?.municipality} fallback="-" />
            <span className={styles.sep} aria-hidden>
              ■
            </span>
            <span>{statusLabel}</span>
            <span className={styles.sep} aria-hidden>
              ■
            </span>
            <span className={live ? styles.tradeLive : styles.tradeFrozen}>
              {live ? t.tradeLive : t.tradeFrozen}
            </span>
          </span>
        </div>
      </header>

      {/* Stats grid */}
      <dl className={styles.stats}>
        <Stat label={t.statRaised} value={formatCurrency(raisedILS)} accent />
        <Stat label={t.statHolders} value={formatNumber(coin.holderCount)} />
        <Stat
          label={t.statSupply}
          value={coin.totalSupply ? formatNumber(Number(coin.totalSupply)) : '-'}
        />
        <Stat
          label={t.statPurchased}
          value={coin.totalPurchased ? formatNumber(Number(coin.totalPurchased)) : '-'}
        />
      </dl>

      {/* Back this BAG - primary action (links out to bags.fm) */}
      <section className={styles.back}>
        <div className={styles.backCopy}>
          <span className={styles.backKicker}>
            <span aria-hidden className={styles.kickerTick} />
            {t.backKicker}
          </span>
          <p className={styles.backLine}>
            {t.backLine1}{' '}
            <strong className={styles.backStrong}>
              {t.backStrong}
            </strong>{' '}
            {t.backLine2}
          </p>
          <p className={styles.backNote}>
            {t.backNote}
          </p>
        </div>
        <div className={styles.backAction}>
          {live && coin.tokenMint ? (
            <NewsButton
              href={`https://bags.fm/${coin.tokenMint}`}
              target="_blank"
              rel="noopener noreferrer"
              variant="red"
              size="lg"
              trailing={<span aria-hidden>↗</span>}
            >
              {t.backCta}
            </NewsButton>
          ) : (
            <div className={styles.backDisabled}>
              <span aria-hidden>□</span>{' '}
              {coin.isFrozen ? t.backFrozen : t.backNotOpen}
            </div>
          )}
        </div>
      </section>

      {/* Layout: seal + holders */}
      <div className={styles.body}>
        {/* On-chain mint */}
        <div className={styles.colSeal}>
          <h2 className={styles.sectionTitle}>{t.mintTitle}</h2>
          {coin.tokenMint ? (
            <SealCard
              hash={coin.tokenMint}
              status={live ? 'sealed' : 'pending'}
              href={`https://solscan.io/token/${coin.tokenMint}`}
              locale={locale}
              meta={[
                {
                  label: t.sealSupply,
                  value: coin.totalSupply ? formatNumber(Number(coin.totalSupply)) : '-',
                },
                { label: t.sealHolders, value: formatNumber(coin.holderCount) },
                { label: t.sealStatus, value: live ? t.sealTrading : t.sealFrozen },
              ]}
            />
          ) : (
            <div className={styles.noMint}>
              <p>{t.noMint}</p>
            </div>
          )}

          {/* How it works */}
          <div className={styles.explainer}>
            <h3 className={styles.explainerTitle}>{t.explainerTitle}</h3>
            <p className={styles.explainerText}>
              {t.explainerText}
            </p>
            <div className={styles.explainerLinks}>
              <NewsButton href={`${localePrefix(locale)}/votes/${voteId}`} variant="red" size="md" trailing={<span aria-hidden>{t.arrow}</span>}>
                {t.voteCta}
              </NewsButton>
              <Link href={`${localePrefix(locale)}/economics`} className={styles.textLink}>
                {t.economicsLink}
              </Link>
            </div>
          </div>
        </div>

        {/* Holders ledger */}
        <div className={styles.colHolders}>
          <h2 className={styles.sectionTitle}>
            {t.ledgerTitle}
            <span className={styles.holderCount}>{formatNumber(holders.length)}</span>
          </h2>

          {holders.length === 0 ? (
            <div className={styles.ledgerEmpty}>
              <span aria-hidden>□</span> {t.ledgerEmpty}
            </div>
          ) : (
            <div className={styles.ledger}>
              <div className={styles.ledgerHead} aria-hidden>
                <span>{t.colHolder}</span>
                <span>{t.colAmount}</span>
                <span>{t.colInvested}</span>
              </div>
              <ul className={styles.ledgerRows}>
                {holders.map((h) => (
                  <li key={h.id} className={styles.ledgerRow}>
                    <span className={styles.holderName}>
                      <span
                        className={h.isLocalResident ? styles.resident : styles.external}
                        aria-hidden
                      >
                        {h.isLocalResident ? '✓' : '·'}
                      </span>
                      {h.displayName}
                      <span className={styles.holderTag}>
                        {h.isLocalResident ? t.residentTag : t.externalTag}
                      </span>
                    </span>
                    <span className={styles.holderAmount}>
                      {formatNumber(Number(h.tokenAmount))}
                    </span>
                    <span className={styles.holderInvested}>
                      {formatCurrency(toILS(h.investedILS))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------- Pieces ---------- */

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`${styles.stat} ${accent ? styles.statAccent : ''}`}>
      <dt className={styles.statLabel}>{label}</dt>
      <dd className={styles.statValue}>{value}</dd>
    </div>
  );
}

function BackLink({ locale }: { locale: Locale }) {
  return (
    <Link className={styles.crumb} href={`${localePrefix(locale)}/coin`}>
      {COPY[locale].crumb}
    </Link>
  );
}

function DossierNotice({ message }: { message: string }) {
  return (
    <div className={styles.notice}>
      <span className={styles.noticeGlyph} aria-hidden>
        ✕
      </span>
      <p className={styles.noticeText}>{message}</p>
    </div>
  );
}

function DossierSkeleton({ locale = 'he' }: { locale?: Locale }) {
  return (
    <section className={styles.page} aria-busy="true" aria-label={COPY[locale].loadingLabel}>
      <div className={styles.head}>
        <span className={`${styles.skel} ${styles.skelSm}`} />
        <span className={`${styles.skel} ${styles.skelTitle}`} />
      </div>
      <div className={styles.stats}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={styles.stat}>
            <span className={`${styles.skel} ${styles.skelSm}`} />
            <span className={`${styles.skel} ${styles.skelMd}`} />
          </div>
        ))}
      </div>
      <div className={styles.body}>
        <div className={`${styles.skel} ${styles.skelBlock}`} />
        <div className={`${styles.skel} ${styles.skelBlock}`} />
      </div>
    </section>
  );
}
