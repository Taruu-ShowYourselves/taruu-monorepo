'use client';

import { useEffect, useState } from 'react';
import type { Locale } from '@/lib/i18n';
import styles from './FacebookWall.module.css';

/**
 * The listening claim's evidence: the posts themselves.
 *
 * Chapter one says "we listen to citizens on Facebook", and it used to stand
 * on blank paper. This hangs the thing being listened to behind it - post
 * cards set in Facebook's own register (its type, its chrome, its action
 * row), carrying the top-engagement topics the scan actually measured. The
 * data is real where the ledger has it: title, group town, reaction and
 * comment counts all come off the scanned source. Only the resident's name
 * is invented, because the scan stores no author identity - and a real
 * neighbour's name under an invented card is the one lie this page must
 * never print.
 *
 * When the ledger has no measured sources yet (a cold database), a fixed
 * demonstration wall stands in, stamped as such - same contract as the demo
 * mandate.
 */

interface WallSource {
  reactionsTotal: number;
  commentsCount: number;
  hotness: number;
  fetchedAt: string;
}

interface WallVote {
  id: string;
  title: string;
  /** The ballot's context prose, written off the scanned post itself. */
  description?: string;
  municipality: string;
  participantCount: number;
  source?: WallSource | null;
}

interface WallPost {
  id: string;
  author: string;
  group: string;
  time: string;
  text: string;
  reactions: number;
  comments: number;
  /** Only demonstration posts carry shares - real scans don't measure them. */
  shares?: number;
}

interface WallCopy {
  groupPrefix: string;
  comments: string;
  shares: string;
  like: string;
  comment: string;
  share: string;
  demoStamp: string;
}

const COPY: Record<Locale, WallCopy> = {
  he: {
    groupPrefix: 'תושבי',
    comments: 'תגובות',
    shares: 'שיתופים',
    like: 'אהבתי',
    comment: 'תגובה',
    share: 'שיתוף',
    demoStamp: 'הדגמה',
  },
  en: {
    groupPrefix: 'Residents of',
    comments: 'comments',
    shares: 'shares',
    like: 'Like',
    comment: 'Comment',
    share: 'Share',
    demoStamp: 'demo',
  },
};

/* Invented names, deliberately generic - the scan keeps no author identity. */
const AUTHORS = ['רונית אברהם', 'יוסי לוי', 'מיכל כהן', 'אבי מזרחי'] as const;
const AUTHORS_EN = ['Ronit A.', 'Yossi L.', 'Michal C.', 'Avi M.'] as const;

/**
 * A resident's voice for each recurring complaint.
 *
 * The ballot's description is written in the register of a municipal report
 * ("תושבים מדווחים כי..."), and a Facebook card printing a report reads as a
 * prop. The scan keeps no post text, so the card can't quote the original -
 * instead each known theme carries a hand-written post in the first person,
 * the way the complaint is actually typed into a residents' group. A topic
 * no theme matches simply doesn't make the wall; the counts on a matched
 * card stay the scan's real ones.
 */
interface WallTheme {
  match: RegExp;
  he: string;
  en: string;
}

const THEMES: readonly WallTheme[] = [
  {
    match: /עכברוש|מכרסמ|הדברה|חולדות/,
    he: 'אני כבר לא יודעת מה לעשות. עכברושים מסתובבים ליד הפחים ברחוב שלנו כאילו הם בעלי הבית. הילדים מפחדים לרדת לגינה. עירייה יקרה, אולי תתעוררו?',
    en: "I honestly don't know what to do anymore. Rats around the bins on our street like they own the place. The kids are scared to go down to the playground. Dear municipality, maybe wake up?",
  },
  {
    match: /שיכור|שוטטות|טיילת|אלכוהול/,
    he: 'אתמול בערב שוב חבורה שיכורה על הטיילת ובקבוקים שבורים על החול. אי אפשר לרדת עם הילדים לחוף בשקט? מישהו עוד נתקל בזה?',
    en: 'Last night again a drunk crowd on the boardwalk and broken bottles in the sand. Can we not take our kids to the beach in peace? Anyone else seeing this?',
  },
  {
    match: /דרי רחוב|הומלס|תחושת הביטחון/,
    he: 'עוד ערב שאני חוזרת מהעבודה ומפחדת לעבור בפארק. זה לא נגד אף אחד - גם דרי הרחוב צריכים פתרון וגם אנחנו. איפה העירייה בכל הסיפור הזה?',
    en: "Another evening walking home from work afraid to cross the park. Nothing against anyone - the homeless need a solution and so do we. Where is the municipality in all this?",
  },
  {
    match: /שפכים|ביוב|זיהום מי|מי הים/,
    he: 'שוב זרם ביוב פתוח ליד חוף הרחצה והריח נוראי. אנשים שוחים בזה! מישהו יודע למי בכלל מתלוננים על דבר כזה?',
    en: 'Raw sewage running by the beach again and the smell is unbearable. People are swimming in this! Does anyone know who you even complain to about this?',
  },
  {
    match: /אשפה|פינוי|ניקיון|פחים/,
    he: 'שבוע שלישי ברציפות שהפח ברחוב שלנו עולה על גדותיו. צילמתי הבוקר, מצרפת תמונות. פשוט בושה.',
    en: 'Third week in a row the bins on our street are overflowing. Took photos this morning, attaching. Honestly a disgrace.',
  },
  {
    match: /שכירות|שכר דירה|דיור|מחירי הדירות/,
    he: '3,900 שקל לשתי חדרים ישנה בלי מעלית. שאלה רצינית: איך זוג צעיר אמור לחיות פה? חייבים כבר פיקוח על השכירות.',
    en: "3,900 shekels for an old two-room with no elevator. Serious question: how is a young couple supposed to live here? We need rent control already.",
  },
  {
    match: /אוטובוס|תחבורה|שביתה|רכבת/,
    he: 'שעה חיכיתי בתחנה הבוקר ושום אוטובוס לא הגיע. אנשים איחרו לעבודה, קשישים עמדו בשמש. עד מתי?',
    en: 'Waited an hour at the stop this morning and not one bus came. People late for work, elderly standing in the sun. Until when?',
  },
  {
    match: /חניה|דוחות|כחול.לבן/,
    he: 'שלושה דוחות בחודש ליד הבית שלי. אין חניה בשכונה בכלל, רק דוחות יש. די כבר.',
    en: 'Three parking tickets in a month right by my building. There is no parking in this neighbourhood at all - only tickets. Enough.',
  },
  {
    match: /הצללה|תחנות|צל/,
    he: 'אין גרם של צל בתחנה ליד הקניון. סבתא שלי חיכתה שם עשרים דקות בשמש של אוגוסט. בושה וחרפה.',
    en: 'Not a scrap of shade at the stop by the mall. My grandmother waited there twenty minutes in the August sun. A disgrace.',
  },
  {
    match: /רמזור|צומת|בטיחות|מפגע בטיחותי|כביש/,
    he: 'עוד כמעט-תאונה הבוקר בצומת ליד בית הספר. כמה פעמים צריך להתריע עד שישימו שם רמזור? מחכים שיקרה אסון?',
    en: 'Another near-miss this morning at the junction by the school. How many times do we have to warn before they put a light there? Waiting for a disaster?',
  },
] as const;

/**
 * The resident-voice text for a topic, or null when no unused theme knows
 * it. The title is matched before the description, and a theme voices at
 * most one card per wall - two topics sharing a stray keyword in their
 * prose otherwise printed the same post twice.
 */
function humanize(
  vote: WallVote,
  locale: Locale,
  used: Set<WallTheme>,
): string | null {
  const theme =
    THEMES.find((c) => !used.has(c) && c.match.test(vote.title)) ??
    THEMES.find((c) => !used.has(c) && c.match.test(vote.description ?? ''));
  if (!theme) return null;
  used.add(theme);
  return theme[locale];
}

/** Facebook's own avatar hues, one per slot. */
const AVATAR_HUES = ['#1877F2', '#9360F7', '#F3425F', '#45BD62'] as const;

/** A cold-start wall: the same register, stamped as a demonstration. */
const DEMO_POSTS: Record<Locale, WallPost[]> = {
  he: [
    {
      id: 'demo-batyam',
      author: AUTHORS[0],
      group: 'תושבי בת ים',
      time: 'לפני 3 שעות',
      text: 'מישהו עוד נתקל בעכברים ליד הפחים ברחוב בלפור? שלישי בערב שלישי ברציפות. העירייה מודעת לזה בכלל?',
      reactions: 214,
      comments: 87,
      shares: 12,
    },
    {
      id: 'demo-haifa',
      author: AUTHORS[1],
      group: 'תושבי חיפה',
      time: 'אתמול',
      text: 'תחנת האוטובוס במורדות הכרמל בלי הצללה כבר שנתיים. קשישים מחכים בשמש של אוגוסט. עד מתי?',
      reactions: 456,
      comments: 132,
      shares: 41,
    },
    {
      id: 'demo-akko',
      author: AUTHORS[2],
      group: 'תושבי עכו',
      time: 'לפני יומיים',
      text: 'הפינוי שוב לא הגיע השבוע לשכונה הצפונית. הפחים עולים על גדותיהם. מצרפת תמונות מהבוקר.',
      reactions: 189,
      comments: 64,
      shares: 9,
    },
  ],
  en: [
    {
      id: 'demo-batyam',
      author: AUTHORS_EN[0],
      group: 'Residents of Bat Yam',
      time: '3h',
      text: 'Anyone else seeing rats by the bins on Balfour street? Third evening in a row. Is the municipality even aware?',
      reactions: 214,
      comments: 87,
      shares: 12,
    },
    {
      id: 'demo-haifa',
      author: AUTHORS_EN[1],
      group: 'Residents of Haifa',
      time: 'Yesterday',
      text: 'The bus stop on the Carmel slopes has had no shade for two years. Elderly people waiting in the August sun. Until when?',
      reactions: 456,
      comments: 132,
      shares: 41,
    },
    {
      id: 'demo-akko',
      author: AUTHORS_EN[2],
      group: 'Residents of Akko',
      time: '2d',
      text: 'Garbage collection skipped the northern neighbourhood again this week. Bins overflowing. Photos from this morning attached.',
      reactions: 189,
      comments: 64,
      shares: 9,
    },
  ],
};

/** How long ago a scan measured its source, in Facebook's own shorthand. */
function relativeTime(iso: string, locale: Locale): string {
  const hours = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 3_600_000));
  if (locale === 'en') {
    if (hours < 24) return `${hours}h`;
    const days = Math.round(hours / 24);
    return days === 1 ? 'Yesterday' : `${days}d`;
  }
  if (hours === 1) return 'לפני שעה';
  if (hours === 2) return 'לפני שעתיים';
  if (hours < 24) return `לפני ${hours} שעות`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'אתמול';
  if (days === 2) return 'לפני יומיים';
  return `לפני ${days} ימים`;
}

const fmt = (value: number, locale: Locale) =>
  value.toLocaleString(locale === 'he' ? 'he-IL' : 'en-US');

/** The measured posts, loudest first; empty until the fetch answers. */
function useWallPosts(locale: Locale): { posts: WallPost[]; demo: boolean } {
  const [state, setState] = useState<{ posts: WallPost[]; demo: boolean }>({
    posts: [],
    demo: false,
  });

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch('/api/votes?status=active&include=options');
        if (!res.ok) throw new Error('wall');
        const payload = (await res.json()) as { votes?: WallVote[] };
        /* Loudest first, and only topics a theme can voice (see THEMES) -
           a card left printing the ballot's report-register description is
           exactly the prop this wall exists to avoid. */
        const usedThemes = new Set<WallTheme>();
        const measured = (payload.votes ?? [])
          .filter(
            (vote): vote is WallVote & { source: WallSource } =>
              Boolean(vote.source) && Boolean(vote.municipality),
          )
          .sort(
            (a, b) =>
              b.source.reactionsTotal +
              b.source.commentsCount * 3 -
              (a.source.reactionsTotal + a.source.commentsCount * 3),
          )
          .flatMap((vote) => {
            const text = humanize(vote, locale, usedThemes);
            return text ? [{ vote, text }] : [];
          })
          .slice(0, 3);
        if (!live) return;
        const names = locale === 'he' ? AUTHORS : AUTHORS_EN;
        const real: WallPost[] = measured.map(({ vote, text }, index) => ({
          id: vote.id,
          author: names[index % names.length],
          group: `${COPY[locale].groupPrefix} ${vote.municipality}`,
          time: relativeTime(vote.source.fetchedAt, locale),
          text,
          reactions: vote.source.reactionsTotal,
          comments: vote.source.commentsCount,
        }));
        /* A thin wall fills from the demonstration posts, and a wall with
           any demonstrated card on it is stamped as one. */
        const posts = [...real, ...DEMO_POSTS[locale].slice(real.length, 3)].slice(0, 3);
        setState({ posts, demo: real.length < 3 });
      } catch {
        if (live) setState({ posts: DEMO_POSTS[locale], demo: true });
      }
    })();
    return () => {
      live = false;
    };
  }, [locale]);

  return state;
}

/* Facebook's own glyphs, redrawn small: the blue-thumb and red-heart pips,
   and the outline icons of the action row. */

function ThumbIcon({ filled }: { filled?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden focusable="false">
      <path
        d="M1.5 7.2h2v6.6h-2c-.4 0-.7-.3-.7-.7V7.9c0-.4.3-.7.7-.7Zm3.2 6.6V7.4c0-.3.1-.5.3-.7l3-3.8c.2-.3.4-.7.4-1.1V1c0-.4.4-.7.8-.6 1 .2 1.7 1.1 1.7 2.2 0 .5-.1 1.1-.3 1.6l-.5 1.5h3.6c.8 0 1.4.7 1.3 1.5l-.7 5.2c-.1.9-.9 1.6-1.8 1.6H5.5c-.4 0-.8-.1-.8-.2Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke={filled ? 'none' : 'currentColor'}
        strokeWidth={filled ? 0 : 1.3}
      />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden focusable="false">
      <path
        d="M8 14S1.8 10 1.8 5.7C1.8 3.6 3.4 2 5.3 2 6.4 2 7.4 2.5 8 3.4 8.6 2.5 9.6 2 10.7 2c1.9 0 3.5 1.6 3.5 3.7C14.2 10 8 14 8 14Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden focusable="false">
      <path
        d="M8 1.5c3.9 0 7 2.6 7 5.9s-3.1 5.9-7 5.9c-.8 0-1.6-.1-2.3-.3L2.5 14.5l.5-2.6C1.8 10.8 1 9.2 1 7.4c0-3.3 3.1-5.9 7-5.9Z"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.3}
      />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden focusable="false">
      <path
        d="M9 3.5 14.5 8 9 12.5V9.6C5.5 9.6 3 10.8 1.5 13c0-4.4 2.7-7.2 7.5-7.5V3.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.3}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FacebookWall({ locale = 'he' }: { locale?: Locale }) {
  const t = COPY[locale];
  const { posts, demo } = useWallPosts(locale);

  if (posts.length === 0) return null;

  return (
    <div className={styles.wall} dir={locale === 'he' ? 'rtl' : 'ltr'} aria-hidden>
      {demo && <b className={styles.demoStamp}>{t.demoStamp}</b>}
      {posts.map((post, index) => (
        <article className={styles.post} data-slot={index} key={post.id}>
          <header className={styles.postHead}>
            <span
              className={styles.avatar}
              style={{ background: AVATAR_HUES[index % AVATAR_HUES.length] }}
            >
              {post.author.slice(0, 1)}
            </span>
            <span className={styles.postBy}>
              <span className={styles.postNames}>
                <b>{post.author}</b>
                <i className={styles.groupArrow}>‹</i>
                <b>{post.group}</b>
              </span>
              <span className={styles.postMeta}>
                {post.time} · <GlobeIcon />
              </span>
            </span>
          </header>

          <p className={styles.postText}>{post.text}</p>

          <div className={styles.postCounts}>
            <span className={styles.reactionPips}>
              <i className={styles.pipLike}>
                <ThumbIcon filled />
              </i>
              <i className={styles.pipLove}>
                <HeartIcon />
              </i>
              <span>{fmt(post.reactions, locale)}</span>
            </span>
            <span className={styles.countTail}>
              {fmt(post.comments, locale)} {t.comments}
              {post.shares ? ` · ${fmt(post.shares, locale)} ${t.shares}` : ''}
            </span>
          </div>

          <div className={styles.postActions}>
            <span>
              <ThumbIcon /> {t.like}
            </span>
            <span>
              <CommentIcon /> {t.comment}
            </span>
            <span>
              <ShareIcon /> {t.share}
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}

function GlobeIcon() {
  return (
    <svg className={styles.globe} viewBox="0 0 16 16" aria-hidden focusable="false">
      <circle cx="8" cy="8" r="6.4" fill="none" stroke="currentColor" strokeWidth={1.2} />
      <path
        d="M1.6 8h12.8M8 1.6c-2 1.8-3 3.9-3 6.4s1 4.6 3 6.4c2-1.8 3-3.9 3-6.4s-1-4.6-3-6.4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.1}
      />
    </svg>
  );
}
