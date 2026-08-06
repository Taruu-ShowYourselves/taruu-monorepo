/* The desk's reading room: a tile opens here, not on another page.
   Everything the detail page prints about a topic that a reader needs in
   order to decide - the standfirst, the plenum background, the document
   summary, the evidence behind the ranking, the live count and the ballot
   itself - is printed inside the dialog, so a click never costs the reader
   their place in the desk. */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import * as Dialog from '@radix-ui/react-dialog';
import { NewsButton } from '@/components/press/NewsButton';
import { useLockPageScroll } from '@/hooks';
import { isMunicipality, municipalityHref } from '@/components/uikit/municipality-link';
import { ParticipationFlow, type FlowOption } from '@/app/[locale]/votes/[id]/flow/ParticipationFlow';
import { localePrefix, type Locale } from '@/lib/i18n';
import {
  RankingMetrics,
  SourceMetrics,
  type DeskRanking,
  type DeskTopic,
} from './DeskTopicRow';
import { topicHeadline } from './deskData';
import styles from './TopicDialog.module.css';

/** Plenum background for Knesset-agenda topics (`GET /api/votes/[id]`). */
interface KnessetContext {
  knessetNum: number | null;
  sessionNumber: number | null;
  sessionDate: string | null;
  ordinal: number | null;
  itemType: string | null;
  isDiscussion: boolean;
  summary?: string | null;
  docUrl?: string | null;
  docGroup?: string | null;
}

/**
 * The slice of `GET /api/votes/[id]` the dialog prints on top of what the
 * tile already handed it. The tile's copy renders immediately; this only
 * fills in what a desk row cannot carry.
 */
interface TopicDetail {
  status: 'active' | 'ended' | 'pending';
  startDate: string | null;
  /** The signed-in reader's existing ballot, if they have one. */
  userVote: string | null;
  knesset: KnessetContext | null;
}

export interface DeskEntry {
  topic: DeskTopic;
  municipality: string;
  /** 1-based rank by heat across the desk. */
  heatRank?: number;
  ranking?: DeskRanking | null;
}

interface DialogCopy {
  liveKicker: string;
  endedKicker: string;
  participants: (count: string) => string;
  daysLeft: (days: number) => string;
  ended: string;
  votesStat: string;
  optionsStat: string;
  remainingStat: string;
  proposalKicker: string;
  docKicker: string;
  docLink: string;
  docNote: string;
  factsKicker: string;
  factItemType: string;
  discussionSuffix: string;
  factKnesset: string;
  factSession: string;
  factOrdinal: string;
  agendaItemPrefix: string;
  factDoc: string;
  docFallback: string;
  resultsKicker: string;
  verifiedVotes: string;
  votesUnit: string;
  votedMessage: string;
  openedOn: string;
  closesOn: string;
  closedOn: string;
  fullPage: string;
  close: string;
  muniProfileTitle: (municipality: string) => string;
  closeLabel: string;
}

const COPY: Record<Locale, DialogCopy> = {
  he: {
    liveKicker: 'הצבעה חיה · ',
    endedKicker: 'ההצבעה הסתיימה · ',
    participants: (count) => `${count} משתתפים`,
    daysLeft: (days) => (days === 0 ? 'מסתיים היום' : `נותרו ${days} ימים`),
    ended: 'הסתיים',
    votesStat: 'קולות',
    optionsStat: 'אפשרויות',
    remainingStat: 'נותרו',
    proposalKicker: 'ההצעה · THE PROPOSAL',
    docKicker: 'מה על השולחן · THE DOCUMENT',
    docLink: 'למסמך הרשמי המלא ↗',
    docNote: 'תקציר אוטומטי מתוך המסמך הרשמי - הנוסח המחייב הוא המקור.',
    factsKicker: 'רקע · BACKGROUND',
    factItemType: 'סוג הסעיף',
    discussionSuffix: ' · דיון',
    factKnesset: 'כנסת',
    factSession: 'ישיבת מליאה',
    factOrdinal: 'מיקום בסדר היום',
    agendaItemPrefix: 'סעיף ',
    factDoc: 'מסמך רשמי',
    docFallback: 'למסמך המלא',
    resultsKicker: 'תוצאות · RESULTS',
    verifiedVotes: 'קולות מאומתים',
    votesUnit: 'קולות',
    votedMessage: 'הצבעתכם נרשמה ונספרה',
    openedOn: 'נפתחה',
    closesOn: 'נסגרת',
    closedOn: 'נסגרה',
    fullPage: 'לעמוד ההצבעה המלא ←',
    close: 'סגירה',
    muniProfileTitle: (municipality) => `פרופיל רשות - ${municipality}`,
    closeLabel: 'סגירת החלון',
  },
  en: {
    liveKicker: 'Live vote · ',
    endedKicker: 'This vote has ended · ',
    participants: (count) => `${count} participants`,
    daysLeft: (days) => (days === 0 ? 'Ends today' : `${days} days left`),
    ended: 'Ended',
    votesStat: 'votes',
    optionsStat: 'options',
    remainingStat: 'remaining',
    proposalKicker: 'THE PROPOSAL',
    docKicker: 'What is on the table · THE DOCUMENT',
    docLink: 'Full official document ↗',
    docNote: 'Automated summary of the official document - the binding text is the original.',
    factsKicker: 'BACKGROUND',
    factItemType: 'Item type',
    discussionSuffix: ' · Discussion',
    factKnesset: 'Knesset',
    factSession: 'Plenum session',
    factOrdinal: 'Place on the agenda',
    agendaItemPrefix: 'Item ',
    factDoc: 'Official document',
    docFallback: 'Full document',
    resultsKicker: 'RESULTS',
    verifiedVotes: 'verified votes',
    votesUnit: 'votes',
    votedMessage: 'Your vote has been recorded and counted',
    openedOn: 'Opened',
    closesOn: 'Closes',
    closedOn: 'Closed',
    fullPage: 'Full vote page →',
    close: 'Close',
    muniProfileTitle: (municipality) => `Municipality profile - ${municipality}`,
    closeLabel: 'Close the dialog',
  },
};

const he = (n: number) => n.toLocaleString('he-IL');

function daysRemaining(endDate: string): number {
  const ms = new Date(endDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
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

/**
 * Pull the parts of the record a desk tile does not carry. Failure is not an
 * error state here: the dialog is already complete without it, so a dead
 * fetch simply leaves the plenum block unprinted.
 */
function useTopicDetail(voteId: string | null): TopicDetail | null {
  const [detail, setDetail] = useState<TopicDetail | null>(null);

  useEffect(() => {
    setDetail(null);
    if (!voteId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/votes/${voteId}`);
        if (!res.ok) return;
        const data = await res.json();
        const vote = data.vote ?? data;
        if (cancelled) return;
        setDetail({
          status: vote.status ?? 'active',
          startDate: vote.startDate ?? null,
          userVote:
            typeof vote.userVote === 'string'
              ? vote.userVote
              : (vote.userVote?.optionId ?? null),
          knesset: vote.knesset ?? null,
        });
      } catch {
        /* The dialog stands without the extra record. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [voteId]);

  return detail;
}

interface TopicDialogProps {
  /** The open entry, or null when the dialog is shut. */
  entry: DeskEntry | null;
  onClose: () => void;
  locale: Locale;
}

/**
 * TopicDialog - the whole topic, in place. Opened from a desk tile with the
 * record the tile already holds, then filled out from `GET /api/votes/[id]`
 * as it lands, so the reader never waits on a blank sheet.
 */
export function TopicDialog({ entry, onClose, locale }: TopicDialogProps) {
  const t = COPY[locale];
  const topic = entry?.topic ?? null;
  const detail = useTopicDetail(topic?.id ?? null);
  /** Ballot recorded inside this dialog - flips the panel to results. */
  const [castOption, setCastOption] = useState<string | null>(null);
  // Every scroll event belongs to the sheet until it closes.
  useLockPageScroll(entry !== null);

  useEffect(() => {
    setCastOption(null);
  }, [topic?.id]);

  return (
    <Dialog.Root open={entry !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.backdrop} />
        {/* `data-lenis-prevent` hands wheel and touch inside the sheet back to
            the browser. Stopping Lenis alone freezes the page but also
            swallows the events the sheet needs to scroll its own overflow. */}
        <Dialog.Content
          className={styles.dialog}
          data-lenis-prevent
          aria-describedby={undefined}
        >
          {entry && topic ? (
            <TopicDialogBody
              entry={entry}
              topic={topic}
              detail={detail}
              castOption={castOption}
              onCast={setCastOption}
              locale={locale}
              t={t}
            />
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface BodyProps {
  entry: DeskEntry;
  topic: DeskTopic;
  detail: TopicDetail | null;
  castOption: string | null;
  onCast: (optionId: string) => void;
  locale: Locale;
  t: DialogCopy;
}

function TopicDialogBody({
  entry,
  topic,
  detail,
  castOption,
  onCast,
  locale,
  t,
}: BodyProps) {
  const { municipality, heatRank, ranking = null } = entry;
  const headline = topicHeadline(topic, ranking);
  const parts = topic.titleParts ?? null;
  const curated = ranking?.headline?.trim() || null;
  const standfirst = ranking?.rationale ?? topic.description;
  const heat = ranking?.hotness ?? topic.source?.hotness ?? null;
  const days = daysRemaining(topic.endDate);
  const totalVotes = topic.options.reduce((sum, o) => sum + o.votes, 0);
  const isActive = (detail?.status ?? 'active') === 'active';
  const recorded = castOption ?? detail?.userVote ?? null;
  const showFlow = isActive && !recorded;
  const knesset = detail?.knesset ?? null;
  const flowOptions: FlowOption[] = topic.options.map((o) => ({
    id: o.id,
    text: o.text,
    votes: o.votes,
  }));

  return (
    <>
      <header
        className={topic.artUrl ? styles.headPlated : styles.head}
        data-plated={topic.artUrl ? '' : undefined}
      >
        {topic.artUrl ? (
          /* The desk agents' commissioned plate, printed whole beside the
             masthead type - the sheet opens on the same image the reader
             clicked, at a size worth the commission. Plain <img> for the
             tile's reason: the file is a pre-optimized WebP from storage and
             next/image optimization is unverified on the Workers runtime. */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={topic.artUrl}
            alt=""
            aria-hidden
            loading="lazy"
            decoding="async"
            className={styles.plate}
          />
        ) : null}

        <div className={styles.headText}>
        <span className={styles.kicker}>
          <span aria-hidden className={styles.kickerTick} />
          {isActive ? t.liveKicker : t.endedKicker}
          {isMunicipality(municipality) ? (
            <Link
              href={municipalityHref(municipality)}
              className={styles.muniLink}
              title={t.muniProfileTitle(municipality)}
            >
              {municipality}
            </Link>
          ) : (
            <span className={styles.muniLink}>{municipality}</span>
          )}
        </span>

        {parts?.kicker ? <span className={styles.billKicker}>{parts.kicker}</span> : null}

        <Dialog.Title className={styles.title}>{headline}</Dialog.Title>

        {!curated && parts?.qualifier ? (
          <span className={styles.billQualifier}>{parts.qualifier}</span>
        ) : null}

        <div className={styles.stats}>
          <span className={styles.stat}>
            <span className={styles.statValue}>{he(totalVotes)}</span>
            <span className={styles.statLabel}>{t.votesStat}</span>
          </span>
          <span className={styles.statDivider} aria-hidden />
          <span className={styles.stat}>
            <span className={styles.statValue}>{topic.options.length}</span>
            <span className={styles.statLabel}>{t.optionsStat}</span>
          </span>
          <span className={styles.statDivider} aria-hidden />
          <span className={styles.stat}>
            <span className={styles.statValue}>
              {isActive ? t.daysLeft(days) : t.ended}
            </span>
            <span className={styles.statLabel}>{t.remainingStat}</span>
          </span>
          {heat !== null ? (
            <>
              <span className={styles.statDivider} aria-hidden />
              <span className={styles.stat}>
                <span className={styles.statValue}>{heat}°</span>
                <span className={styles.statLabel}>
                  {t.participants(he(topic.participantCount))}
                </span>
              </span>
            </>
          ) : null}
        </div>
        </div>
      </header>

      <div className={styles.rule} aria-hidden />

      <div className={styles.spread}>
        <article className={styles.story}>
          <span className={styles.colKicker}>{t.proposalKicker}</span>
          <p className={styles.standfirst}>{standfirst}</p>
          {/* The rationale is the standfirst on ranked items; the agenda text
              is then the body copy rather than a repeat of it. */}
          {standfirst !== topic.description ? (
            <p className={styles.body}>{topic.description}</p>
          ) : null}

          {knesset?.summary ? (
            <section className={styles.block} aria-label={t.docKicker}>
              <span className={styles.colKicker}>{t.docKicker}</span>
              <p className={styles.body}>{knesset.summary}</p>
              <div className={styles.blockMeta}>
                {knesset.docGroup ? <span>{knesset.docGroup}</span> : null}
                {knesset.docUrl ? (
                  <a
                    href={knesset.docUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.link}
                  >
                    {t.docLink}
                  </a>
                ) : null}
              </div>
              <p className={styles.note}>{t.docNote}</p>
            </section>
          ) : null}

          {knesset ? (
            <section className={styles.block} aria-label={t.factsKicker}>
              <span className={styles.colKicker}>{t.factsKicker}</span>
              <dl className={styles.facts}>
                {knesset.itemType ? (
                  <div className={styles.fact}>
                    <dt>{t.factItemType}</dt>
                    <dd>
                      {knesset.itemType}
                      {knesset.isDiscussion ? t.discussionSuffix : ''}
                    </dd>
                  </div>
                ) : null}
                {knesset.knessetNum ? (
                  <div className={styles.fact}>
                    <dt>{t.factKnesset}</dt>
                    <dd>{knesset.knessetNum}</dd>
                  </div>
                ) : null}
                {knesset.sessionNumber ? (
                  <div className={styles.fact}>
                    <dt>{t.factSession}</dt>
                    <dd>
                      {knesset.sessionNumber}
                      {knesset.sessionDate ? ` · ${formatDate(knesset.sessionDate)}` : ''}
                    </dd>
                  </div>
                ) : null}
                {knesset.ordinal ? (
                  <div className={styles.fact}>
                    <dt>{t.factOrdinal}</dt>
                    <dd>
                      {t.agendaItemPrefix}
                      {knesset.ordinal}
                    </dd>
                  </div>
                ) : null}
                {!knesset.summary && knesset.docUrl ? (
                  <div className={styles.fact}>
                    <dt>{t.factDoc}</dt>
                    <dd>
                      <a
                        href={knesset.docUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.link}
                      >
                        {knesset.docGroup ?? t.docFallback} ↗
                      </a>
                    </dd>
                  </div>
                ) : null}
              </dl>
            </section>
          ) : null}

          {topic.source ? (
            <SourceMetrics source={topic.source} heatRank={heatRank} locale={locale} />
          ) : ranking ? (
            <RankingMetrics ranking={ranking} heatRank={heatRank} locale={locale} />
          ) : null}

          <p className={styles.timeline}>
            {detail?.startDate ? (
              <>
                <span>
                  {t.openedOn} {formatDate(detail.startDate)}
                </span>
                <span className={styles.sep} aria-hidden>
                  ■
                </span>
              </>
            ) : null}
            <span>
              {isActive
                ? `${t.closesOn} ${formatDate(topic.endDate)}`
                : `${t.closedOn} ${formatDate(topic.endDate)}`}
            </span>
          </p>
        </article>

        <aside className={styles.panel}>
          {showFlow ? (
            <ParticipationFlow
              voteId={topic.id}
              voteTitle={headline}
              options={flowOptions}
              totalVotes={totalVotes}
              onComplete={onCast}
            />
          ) : (
            <section className={styles.results} aria-label={t.resultsKicker}>
              <header className={styles.resultsHead}>
                <span className={styles.colKicker}>{t.resultsKicker}</span>
                <span className={styles.resultsCount}>
                  {he(totalVotes)} {t.verifiedVotes}
                </span>
              </header>

              <ul className={styles.options}>
                {topic.options.map((option) => {
                  const isMine = recorded === option.id;
                  return (
                    <li
                      key={option.id}
                      className={isMine ? styles.optionMine : styles.option}
                    >
                      <span className={styles.optionTop}>
                        <span className={styles.mark} aria-hidden>
                          {isMine ? '■' : '□'}
                        </span>
                        <span className={styles.optionLabel}>{option.text}</span>
                        <span className={styles.pct}>{option.pct}%</span>
                      </span>
                      <span className={styles.track} aria-hidden>
                        <span
                          className={styles.fill}
                          style={{ inlineSize: `${option.pct}%` }}
                        />
                      </span>
                      <span className={styles.optionCount}>
                        {he(option.votes)} {t.votesUnit}
                      </span>
                    </li>
                  );
                })}
              </ul>

              {recorded ? (
                <p className={styles.voted}>
                  <span aria-hidden>✓</span> {t.votedMessage}
                </p>
              ) : null}
            </section>
          )}
        </aside>
      </div>

      <footer className={styles.foot}>
        <Link href={`${localePrefix(locale)}/votes/${topic.id}`} className={styles.link}>
          {t.fullPage}
        </Link>
        <Dialog.Close asChild>
          <NewsButton variant="outline" size="md">
            {t.close}
          </NewsButton>
        </Dialog.Close>
      </footer>

      <Dialog.Close className={styles.closeX} aria-label={t.closeLabel}>
        <span aria-hidden>✕</span>
      </Dialog.Close>
    </>
  );
}
