"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import Link from "next/link";
import { animate, createScope, stagger } from "animejs";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { localePath, localePrefix } from "@/lib/i18n/config";
import type { Locale } from "@/lib/i18n";
import { topReactions } from "@/components/press/reactions";
import {
  interleaveByCity,
  ISRAEL_MAP_PATH,
  MAP_VIEWBOX,
  type MapPoint,
} from "./israel-map";
import { structureKnessetTitle } from "./knesset-title";
import styles from "./CinematicIntro.module.css";

interface SignalSource {
  reactions: Record<string, number>;
  reactionsTotal: number;
  commentsCount: number;
  postCount: number;
  /** 0–100 engagement heat. */
  hotness: number;
  /** Original Facebook post/group URL stored with the scan evidence. */
  url: string | null;
  /** Last time the source engagement was measured. */
  fetchedAt: string;
}

interface SignalVote {
  id: string;
  title: string;
  municipality: string;
  participantCount: number;
  updatedAt: string;
  source?: SignalSource | null;
}

interface PublicLedgerStats {
  municipalities: number | null;
  knessetTopics: number | null;
  municipalTopics: number | null;
  facebookGroups: number | null;
  facebookPosts: number | null;
  peopleInvolved: number | null;
}

interface KnessetEvidence {
  official: {
    sessionDate: string | null;
    itemType: string | null;
    ordinal: number | null;
    docUrl: string | null;
    docGroup: string | null;
    summary: string | null;
    fetchedAt: string;
  } | null;
  ranking: {
    hotness: number;
    relevance: number | null;
    media: number | null;
    rationale: string | null;
    mediaRefs: string[];
    rankedAt: string | null;
  } | null;
}

/** A signal that resolved to a place on the map. */
interface PlacedSignal {
  signal: SignalVote;
  point: MapPoint;
}

interface IntroCopy {
  /** Thesis ledger (CivicSignalMap). */
  metricMunicipalities: string;
  metricKnessetTopics: string;
  metricMunicipalTopics: string;
  metricFacebookGroups: string;
  metricFacebookPosts: string;
  metricPeopleInvolved: string;
  metricBestCity: string;
  metricPressingKnesset: string;
  ledgerAria: string;
  ledgerHeader: string;
  measuringNow: string;
  /** Shared measures. */
  voted: string;
  postsWord: string;
  /** Municipal dispatch card. */
  heatTitle: string;
  scanned: string;
  onePost: string;
  inGroupOf: string;
  measuredOn: string;
  facebookSourceLink: string;
  activeVoteCta: string;
  /** Direction-semantic "continue" glyph: Hebrew ←, English →. */
  backGlyph: string;
  /** Proposal briefs; `{subject}` is replaced with the live title. */
  briefRegulate: string;
  briefAffirm: string;
  briefAdvance: string;
  /** Brand. */
  brandName: string;
  socialsAria: string;
  /** Label of the *other* locale, shown on the language switch. */
  localeSwitchLabel: string;
  localeSwitchAria: string;
  sectionAria: string;
  /** Question scene, split to preserve the animated inline markup. */
  q1pre: string;
  q1mark: string;
  q1mid: string;
  q1em: string;
  q1end: string;
  q2pre: string;
  q2mark: string;
  q2mid: string;
  q2strong: string;
  participantCountLabel: string;
  municipalDecisionsLabel: string;
  nationalDecisionsLabel: string;
  primaryCta: string;
  secondaryCta: string;
  scrollCue: string;
  /** Comparison scene. */
  muniPanelTitle: string;
  mapAria: string;
  legendActive: string;
  legendAreas: string;
  knessetPanelTitle: string;
  knessetLede: string;
  relevanceLabel: string;
  coverageLabel: string;
  knessetVoteCta: string;
  officialDocLink: string;
  mediaSourceLink: string;
  connecting: string;
  fullAgendaCta: string;
  /** Thesis scene. */
  thesisKicker: string;
  thesisA: string;
  thesisB: string;
  thesisC: string;
  thesisLede: string;
}

const COPY: Record<Locale, IntroCopy> = {
  he: {
    metricMunicipalities: "רשויות במסד הנתונים",
    metricKnessetTopics: "נושאי כנסת",
    metricMunicipalTopics: "נושאים עירוניים",
    metricFacebookGroups: "קבוצות פייסבוק שהתגלו",
    metricFacebookPosts: "פוסטים שנצפו",
    metricPeopleInvolved: "אזרחים מעורבים",
    metricBestCity: "העיר המובילה במעורבות אזרחית",
    metricPressingKnesset: "הצבעת הכנסת הבוערת",
    ledgerAria: "שדה הנתונים האזרחי של תראו",
    ledgerHeader: "תַּרְאוּ מודדת עכשיו",
    measuringNow: "נמדד עכשיו",
    voted: "הצביעו",
    postsWord: "פוסטים",
    heatTitle: "חום ציבורי - ריאקציות ותגובות במקור",
    scanned: "סרקנו",
    onePost: "פוסט אחד",
    inGroupOf: "בקבוצת הפייסבוק של",
    measuredOn: "נמדד",
    facebookSourceLink: "למקור בפייסבוק ↗",
    activeVoteCta: "להצבעה הפעילה",
    backGlyph: "←",
    briefRegulate: "ההצעה מבקשת להסדיר בחקיקה את {subject}.",
    briefAffirm: "הסעיף מבקש לאשר את {subject}.",
    briefAdvance: "הסעיף מבקש לקדם את {subject}.",
    brandName: "תַּרְאוּ",
    socialsAria: "תַּרְאוּ ברשתות החברתיות",
    localeSwitchLabel: "EN",
    localeSwitchAria: "Switch to English",
    sectionAria: "מרעש ציבורי לסדר יום משותף",
    q1pre: "אם ",
    q1mark: "מיליון אנשים",
    q1mid: " מתלוננים ",
    q1em: "בפייסבוק",
    q1end: ",",
    q2pre: "למה ",
    q2mark: "אף אחד",
    q2mid: " לא ",
    q2strong: "שומע אותם?",
    participantCountLabel: "אזרחים משתתפים",
    municipalDecisionsLabel: "החלטות אזרחיות (בתהליך) בעניינים אזרחיים",
    nationalDecisionsLabel: "החלטות אזרחיות (בתהליך) בעניינים מדיניים",
    primaryCta: "להשתתפות במשאלי העם",
    secondaryCta: "לסדר היום הציבורי",
    scrollCue: "גללו",
    muniPanelTitle: "מוקדי עניין עירוניים",
    mapAria: "מפת ישראל עם מוקדי שיח ציבורי",
    legendActive: "מוקד פעיל",
    legendAreas: "אזורים באוויר",
    knessetPanelTitle: "סדר היום בכנסת",
    knessetLede: "הנושאים הארציים שמצטברים עכשיו לקול ציבורי מדיד.",
    relevanceLabel: "רלוונטיות",
    coverageLabel: "סיקור",
    knessetVoteCta: "להצבעה הפעילה ←",
    officialDocLink: "למסמך הרשמי ↗",
    mediaSourceLink: "מקור תקשורתי ↗",
    connecting: "מתחבר למסד הנתונים…",
    fullAgendaCta: "לכל סדר היום הציבורי",
    thesisKicker: "עד עכשיו",
    thesisA: "עד היום, כל אחד",
    thesisB: "צעק לבד.",
    thesisC: "תַּרְאוּ.",
    thesisLede: "לראשונה הציבור מקבל מבנה לכוחו.",
  },
  en: {
    metricMunicipalities: "Municipalities in the database",
    metricKnessetTopics: "Knesset topics",
    metricMunicipalTopics: "Municipal topics",
    metricFacebookGroups: "Facebook groups discovered",
    metricFacebookPosts: "Posts observed",
    metricPeopleInvolved: "Citizens involved",
    metricBestCity: "Leading city in civic engagement",
    metricPressingKnesset: "The most pressing Knesset vote",
    ledgerAria: "Taruu's civic data field",
    ledgerHeader: "Taruu is measuring now",
    measuringNow: "Measuring now",
    voted: "voted",
    postsWord: "posts",
    heatTitle: "Public heat - reactions and comments at the source",
    scanned: "We scanned",
    onePost: "one post",
    inGroupOf: "in the Facebook group of",
    measuredOn: "Measured",
    facebookSourceLink: "Source on Facebook ↗",
    activeVoteCta: "To the active vote",
    backGlyph: "→",
    briefRegulate: "The bill seeks to anchor {subject} in legislation.",
    briefAffirm: "The item seeks to approve {subject}.",
    briefAdvance: "The item seeks to advance {subject}.",
    brandName: "Taruu",
    socialsAria: "Taruu on social networks",
    localeSwitchLabel: "עברית",
    localeSwitchAria: "מעבר לעברית",
    sectionAria: "From public noise to a shared agenda",
    q1pre: "If ",
    q1mark: "a million people",
    q1mid: " are complaining on ",
    q1em: "Facebook",
    q1end: ",",
    q2pre: "why does ",
    q2mark: "no one",
    q2mid: " ",
    q2strong: "hear them?",
    participantCountLabel: "Participating citizens",
    municipalDecisionsLabel: "Civic decisions in progress on local issues",
    nationalDecisionsLabel: "Civic decisions in progress on national issues",
    primaryCta: "To the live topic map",
    secondaryCta: "To the public agenda",
    scrollCue: "Scroll",
    muniPanelTitle: "Municipal focal points",
    mapAria: "Map of Israel with centers of public discussion",
    legendActive: "Active hotspot",
    legendAreas: "areas on air",
    knessetPanelTitle: "The Knesset agenda",
    knessetLede: "The national topics now accumulating into a measurable public voice.",
    relevanceLabel: "Relevance",
    coverageLabel: "Coverage",
    knessetVoteCta: "To the active vote →",
    officialDocLink: "Official document ↗",
    mediaSourceLink: "Media source ↗",
    connecting: "Connecting to the database…",
    fullAgendaCta: "The full public agenda",
    thesisKicker: "Until now",
    thesisA: "Until today, everyone",
    thesisB: "shouted alone.",
    thesisC: "Taruu.",
    thesisLede: "For the first time, the public has structure for its power.",
  },
};

const KNESSET_SCOPE = /כנסת|ארצי|ישראל/;

/**
 * Far-field slots for the live-city micro-marks behind the thesis. Fixed and
 * asymmetric on purpose: the scatter must never resolve into a ring or a
 * grid, and every slot stays clear of the centered headline column.
 * depth: 0 = deepest in the field, 1 = closest to the reader.
 */
const DUST_SLOTS = [
  { x: "16%", y: "9%", depth: 0.3 },
  { x: "42%", y: "5%", depth: 0.2 },
  { x: "68%", y: "10%", depth: 0.35 },
  { x: "86%", y: "21%", depth: 0.25 },
  { x: "7%", y: "44%", depth: 0.2 },
  { x: "91%", y: "48%", depth: 0.3 },
  { x: "12%", y: "70%", depth: 0.25 },
  { x: "82%", y: "68%", depth: 0.2 },
  { x: "30%", y: "84%", depth: 0.3 },
  { x: "60%", y: "86%", depth: 0.25 },
] as const;

/**
 * Dwell per TOC - slow enough to actually read, and deliberately unequal
 * between the desks so the two rotations never fall into lockstep.
 */
const MUNI_ROTATION_MS = 6200;
const KNESSET_ROTATION_MS = 4700;

type Advance = (next: (current: number) => number) => void;

/** Advance a desk's cursor on its own clock; no-op while held or trivial. */
function rotate(
  window_: number,
  paused: boolean,
  dwellMs: number,
  advance: Advance,
): (() => void) | undefined {
  if (window_ < 2 || paused) return undefined;
  const interval = window.setInterval(
    () => advance((current) => (current + 1) % window_),
    dwellMs,
  );
  return () => window.clearInterval(interval);
}

/** Pointer/focus handlers that hold one desk's rotation. */
function holdHandlers(setPaused: (paused: boolean) => void) {
  return {
    onMouseEnter: () => setPaused(true),
    onMouseLeave: () => setPaused(false),
    onFocusCapture: () => setPaused(true),
    onBlurCapture: () => setPaused(false),
  };
}

const voteHref = (id: string, locale: Locale) => `${localePrefix(locale)}/votes/${id}`;

const heatOf = (signal: SignalVote) => signal.source?.hotness ?? 0;

/** Hottest first, ties broken by turnout. Applied per desk, never across. */
const byHeat = (a: SignalVote, b: SignalVote) =>
  heatOf(b) - heatOf(a) || b.participantCount - a.participantCount;

const he = (value: number) => value.toLocaleString("he-IL");

interface CivicSignalMapProps {
  stats: PublicLedgerStats;
  mapSignals: PlacedSignal[];
  bestCity: string | null;
  pressingKnesset: string | null;
  t: IntroCopy;
}

function CivicSignalMap({
  stats,
  mapSignals,
  bestCity,
  pressingKnesset,
  t,
}: CivicSignalMapProps) {
  // depth: how close the mark floats to the reader. Drives scale, blur,
  // opacity and scroll parallax; the loudest numbers sit nearest.
  const metrics = [
    { label: t.metricMunicipalities, value: stats.municipalities, depth: 0.6 },
    { label: t.metricKnessetTopics, value: stats.knessetTopics, depth: 0.92 },
    { label: t.metricMunicipalTopics, value: stats.municipalTopics, depth: 0.75 },
    {
      label: t.metricFacebookGroups,
      value: stats.facebookGroups,
      depth: 0.35,
    },
    { label: t.metricFacebookPosts, value: stats.facebookPosts, depth: 1 },
    { label: t.metricPeopleInvolved, value: stats.peopleInvolved, depth: 0.45 },
    {
      label: t.metricBestCity,
      value: bestCity,
      feature: true,
      depth: 0.7,
    },
    {
      label: t.metricPressingKnesset,
      value: pressingKnesset,
      feature: true,
      depth: 0.55,
    },
  ];

  return (
    <aside
      className={styles.thesisLedger}
      data-thesis-ledger
      aria-label={t.ledgerAria}
      aria-live="polite"
    >
      <header className={styles.ledgerHeader}>
        <span>{t.ledgerHeader}</span>
      </header>

      <div className={styles.ledgerDust} aria-hidden>
        {mapSignals.slice(0, DUST_SLOTS.length).map(({ signal }, index) => {
          const slot = DUST_SLOTS[index];
          return (
            <span
              className={styles.dustMark}
              data-thesis-dust
              data-depth={slot.depth}
              key={signal.municipality}
              style={
                {
                  "--dust-x": slot.x,
                  "--dust-y": slot.y,
                  "--depth": slot.depth,
                } as CSSProperties
              }
            >
              {signal.municipality}
            </span>
          );
        })}
      </div>

      <dl className={styles.thesisMetricMap}>
        {metrics.map((metric, index) => (
          <div
            className={`${styles.ledgerMetric} ${metric.feature ? styles.ledgerMetricFeature : ""}`}
            data-thesis-metric
            data-depth={metric.depth}
            key={metric.label}
            style={
              {
                "--metric-delay": `${index * 0.13}s`,
                "--depth": metric.depth,
              } as CSSProperties
            }
          >
            <dt>{metric.label}</dt>
            <dd>
              {metric.value === null
                ? t.measuringNow
                : typeof metric.value === "number"
                  ? he(metric.value)
                  : metric.value}
            </dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

/**
 * The counted evidence behind a TOC: the loudest reactions and the comment
 * volume as measured at the source, then how many people already voted here.
 */
function SignalMetrics({ signal, t }: { signal: SignalVote; t: IntroCopy }) {
  const source = signal.source;
  const reactions = source ? topReactions(source.reactions, 6) : [];

  return (
    <div className={styles.tocMetrics}>
      {reactions.map(({ kind, glyph, total }) => (
        <span key={kind}>
          <i aria-hidden>{glyph}</i>
          {he(total)}
        </span>
      ))}
      {source && source.commentsCount > 0 && (
        <span>
          <i aria-hidden>💬</i>
          {he(source.commentsCount)}
        </span>
      )}
      {signal.participantCount > 0 && (
        <span className={styles.tocParticipants}>
          {he(signal.participantCount)} {t.voted}
        </span>
      )}
    </div>
  );
}

/** Last source measurement, fixed to Israel time to avoid hydration drift. */
function sourceDate(value: string): string {
  return new Intl.DateTimeFormat("he-IL", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Jerusalem",
  }).format(new Date(value));
}

/** Official Knesset date, kept compact enough for the live desk. */
function officialDate(value: string): string {
  return new Intl.DateTimeFormat("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Jerusalem",
  }).format(new Date(value));
}

/** A compact statement of what an agenda item seeks to advance. */
function proposalBrief(
  signal: SignalVote,
  t: IntroCopy,
  evidence?: KnessetEvidence,
): string {
  const generated = (
    evidence?.official?.summary ?? evidence?.ranking?.rationale
  )
    ?.replace(/\u2014/g, ",")
    .trim();
  if (generated) {
    const singleLine = generated.replace(/\s+/g, " ");
    if (singleLine.length <= 190) return singleLine;
    return `${singleLine.slice(0, 187).trimEnd()}…`;
  }

  const title = signal.title.replace(/\u2014/g, ",").trim();
  if (title.startsWith("הצעת חוק")) {
    const subject = title
      .replace(/^הצעת חוק\s*/, "")
      .replace(/,?\s*התשפ[^,]*$/u, "")
      .trim();
    return t.briefRegulate.replace("{subject}", () => subject);
  }
  if (title.startsWith("הצהרת אמונים")) {
    return t.briefAffirm.replace("{subject}", () => title);
  }
  return t.briefAdvance.replace("{subject}", () => title);
}

/**
 * Place the HTML evidence card in the same coordinate space as the SVG pin.
 * The x offset leaves a short leader line between the marker and the card.
 */
function dispatchPosition(point: MapPoint): CSSProperties {
  const x = ((point.x + 20 + 26) / 360) * 100;
  const y = (point.y / 710) * 100;
  return {
    "--toc-x": `${x}%`,
    "--toc-y": `${y}%`,
    "--toc-dwell": `${MUNI_ROTATION_MS}ms`,
  } as CSSProperties;
}

function MunicipalDispatchContent({
  signal,
  paused,
  t,
  locale,
}: {
  signal: SignalVote;
  paused: boolean;
  t: IntroCopy;
  locale: Locale;
}) {
  return (
    <>
      <div className={styles.tocHead}>
        <span>{signal.municipality} · MUNICIPAL TOC</span>
        {signal.source && (
          <b
            className={styles.tocHeat}
            title={t.heatTitle}
          >
            🔥 {signal.source.hotness}°
          </b>
        )}
      </div>

      <strong className={styles.tocTitle}>{signal.title}</strong>

      {signal.source && (
        <div className={styles.tocSource}>
          <span className={styles.tocSourceLabel}>
            <i aria-hidden /> FACEBOOK GROUP SCAN
          </span>
          <p>
            {t.scanned}{" "}
            {signal.source.postCount === 1
              ? t.onePost
              : `${he(signal.source.postCount)} ${t.postsWord}`}{" "}
            {t.inGroupOf} <strong>{signal.municipality}</strong>.
          </p>
          <div className={styles.tocSourceMeta}>
            <span>
              {t.measuredOn} {sourceDate(signal.source.fetchedAt)}
            </span>
            {signal.source.url && (
              <a
                href={signal.source.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t.facebookSourceLink}
              </a>
            )}
          </div>
        </div>
      )}

      <SignalMetrics signal={signal} t={t} />

      <div className={styles.tocFoot}>
        <Link className={styles.tocCta} href={voteHref(signal.id, locale)}>
          {t.activeVoteCta}
          <i aria-hidden>{t.backGlyph}</i>
        </Link>
        <span
          className={styles.tocProgress}
          data-paused={paused || undefined}
          aria-hidden
        />
      </div>
    </>
  );
}

const INTRO_SOCIALS = [
  {
    href: "https://instagram.com/taro.il",
    label: "Instagram",
    icon: "instagram",
  },
  {
    href: "https://facebook.com/taro.il",
    label: "Facebook",
    icon: "facebook",
  },
  {
    href: "https://twitter.com/taro_il",
    label: "X (Twitter)",
    icon: "x",
  },
] as const;

/**
 * How much of the three-act intro to run.
 *
 * `full` is the original story: the question ("if a million people are
 * complaining on Facebook..."), the live map/agenda comparison, then the
 * thesis. It argues the case before showing anything, which is what an
 * investor edition wants and what a resident does not - they arrive to find
 * out what is open in their town, and four screens of argument stand between
 * them and it.
 *
 * `thesis` opens on the last act alone: the wordmark, the line, and the live
 * ledger behind it. The homepage runs this; /pitchdeck keeps `full`.
 */
export type IntroStory = "full" | "thesis";

interface CinematicIntroProps {
  locale?: Locale;
  story?: IntroStory;
}

export function CinematicIntro({
  locale = "he",
  story: storyVariant = "full",
}: CinematicIntroProps) {
  const t = COPY[locale];
  const thesisOnly = storyVariant === "thesis";
  const otherLocale: Locale = locale === "he" ? "en" : "he";
  const rootRef = useRef<HTMLElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const [signals, setSignals] = useState<SignalVote[]>([]);
  // The two desks are separate publications: separate cursors, separate
  // dwell times, separate holds. Nothing about one moves the other.
  const [activeMuniIndex, setActiveMuniIndex] = useState(0);
  const [activeKnessetIndex, setActiveKnessetIndex] = useState(0);
  const [muniPaused, setMuniPaused] = useState(false);
  const [knessetPaused, setKnessetPaused] = useState(false);
  const [lastSignalSync, setLastSignalSync] = useState<Date | null>(null);
  const [publicLedger, setPublicLedger] = useState<PublicLedgerStats>({
    municipalities: null,
    knessetTopics: null,
    municipalTopics: null,
    facebookGroups: null,
    facebookPosts: null,
    peopleInvolved: null,
  });
  const [knessetEvidence, setKnessetEvidence] = useState<
    Record<string, KnessetEvidence>
  >({});

  const advanceToLiveMap = () => {
    const root = rootRef.current;
    if (!root) return;
    const storyTop = root.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({
      top: storyTop + window.innerHeight * 1.05,
      behavior: shouldReduceMotion ? "auto" : "smooth",
    });
  };

  useEffect(() => {
    const controller = new AbortController();

    async function loadSignals() {
      try {
        const response = await fetch(
          "/api/votes?status=active&include=options",
          {
            signal: controller.signal,
            cache: "no-store",
          },
        );
        if (!response.ok) throw new Error("active signals");
        const payload = await response.json();
        const votes = (payload.votes as SignalVote[] | undefined) ?? [];
        if (controller.signal.aborted) return;
        // Stored raw: each desk does its own filtering, ordering and
        // deduping downstream, so neither scope can reorder the other.
        setSignals(votes);
        setLastSignalSync(new Date());

        const knessetTopics = votes.filter((vote) =>
          KNESSET_SCOPE.test(vote.municipality),
        ).length;
        setPublicLedger((current) => ({
          ...current,
          knessetTopics,
          municipalTopics: votes.length - knessetTopics,
        }));

        // Evidence for the hottest votes is resolved server-side (`top`):
        // slicing N ids client-side by arrival order meant the actually
        // burning vote could miss the evidence set entirely.
        if (knessetTopics > 0) {
          try {
            const contextResponse = await fetch(
              "/api/knesset/live-context?top=20",
              { signal: controller.signal, cache: "no-store" },
            );
            if (contextResponse.ok && !controller.signal.aborted) {
              const contextPayload = (await contextResponse.json()) as {
                evidence?: Record<string, KnessetEvidence>;
              };
              setKnessetEvidence(contextPayload.evidence ?? {});
            }
          } catch {
            if (!controller.signal.aborted) setKnessetEvidence({});
          }
        }
      } catch {
        if (!controller.signal.aborted) {
          setSignals([]);
          setKnessetEvidence({});
        }
      }
    }

    async function loadPublicLedger() {
      try {
        const [networkResponse, registrationsResponse] = await Promise.all([
          fetch("/api/stats/network", {
            signal: controller.signal,
            cache: "no-store",
          }),
          fetch("/api/stats/registrations", {
            signal: controller.signal,
            cache: "no-store",
          }),
        ]);

        const next: Partial<PublicLedgerStats> = {};

        if (networkResponse.ok) {
          const networkPayload = (await networkResponse.json()) as {
            stats?: {
              municipalitiesInDatabase?: number;
              facebookGroups?: number;
              facebookPosts?: number;
            };
          };
          if (
            typeof networkPayload.stats?.municipalitiesInDatabase === "number"
          ) {
            next.municipalities = networkPayload.stats.municipalitiesInDatabase;
          }
          if (typeof networkPayload.stats?.facebookGroups === "number") {
            next.facebookGroups = networkPayload.stats.facebookGroups;
          }
          if (typeof networkPayload.stats?.facebookPosts === "number") {
            next.facebookPosts = networkPayload.stats.facebookPosts;
          }
        }

        if (registrationsResponse.ok) {
          const registrationsPayload =
            (await registrationsResponse.json()) as {
              stats?: { registeredTotal?: number };
            };
          if (
            typeof registrationsPayload.stats?.registeredTotal === "number"
          ) {
            next.peopleInvolved = registrationsPayload.stats.registeredTotal;
          }
        }

        if (!controller.signal.aborted) {
          setPublicLedger((current) => ({ ...current, ...next }));
        }
      } catch {
        // Keep the last confirmed aggregate during a transient stats outage.
      }
    }

    void loadSignals();
    void loadPublicLedger();
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadSignals();
        void loadPublicLedger();
      }
    }, 30_000);
    return () => {
      window.clearInterval(poll);
      controller.abort();
    };
  }, []);

  // A municipal topic only enters the live map when the ingest supplied
  // measured source evidence. Seed rows remain a last-resort fallback so a
  // disconnected development database still renders a useful map.
  const municipalSignals = useMemo(() => {
    const municipal = signals.filter(
      (signal) => !KNESSET_SCOPE.test(signal.municipality),
    );
    const evidenceBacked = municipal.filter((signal) => signal.source);
    return (evidenceBacked.length > 0 ? evidenceBacked : municipal).sort(
      byHeat,
    );
  }, [signals]);

  const knessetSignals = useMemo(
    () =>
      signals
        .filter((signal) => KNESSET_SCOPE.test(signal.municipality))
        .sort((a, b) => {
          const aRank = knessetEvidence[a.id]?.ranking?.hotness ?? 0;
          const bRank = knessetEvidence[b.id]?.ranking?.hotness ?? 0;
          return bRank - aRank || byHeat(a, b);
        }),
    [signals, knessetEvidence],
  );

  /**
   * Topics without a resolvable municipality stay off the geographic desk.
   * Placement interleaves by city so one loud city's backlog can't fill the
   * whole window and push every other municipality off the map.
   */
  const placedMunicipalSignals = useMemo<PlacedSignal[]>(
    () => interleaveByCity(municipalSignals, 24),
    [municipalSignals],
  );

  /** The map draws one clean pin per city while its card rotates every topic. */
  const mapSignals = useMemo<PlacedSignal[]>(() => {
    const seen = new Set<string>();
    return placedMunicipalSignals.filter(({ signal }) => {
      if (seen.has(signal.municipality)) return false;
      seen.add(signal.municipality);
      return true;
    });
  }, [placedMunicipalSignals]);

  const bestCivicCity = useMemo(() => {
    const scores = new Map<string, number>();
    for (const signal of municipalSignals) {
      if (!signal.municipality) continue;
      const score =
        signal.participantCount * 4 +
        (signal.source?.reactionsTotal ?? 0) +
        (signal.source?.commentsCount ?? 0) * 3 +
        (signal.source?.postCount ?? 0);
      scores.set(
        signal.municipality,
        (scores.get(signal.municipality) ?? 0) + score,
      );
    }
    return [...scores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }, [municipalSignals]);

  const pressingKnesset = useMemo(() => {
    const signal = knessetSignals[0];
    if (!signal) return null;
    return structureKnessetTitle(
      signal.title,
      knessetEvidence[signal.id]?.official?.itemType,
      locale,
    ).headline;
  }, [knessetSignals, knessetEvidence, locale]);

  const municipalWindow = Math.min(placedMunicipalSignals.length, 10);
  const knessetWindow = Math.min(knessetSignals.length, 6);
  const activeMunicipal =
    municipalWindow > 0
      ? placedMunicipalSignals[activeMuniIndex % municipalWindow]
      : undefined;
  const activeMunicipalSignal = activeMunicipal?.signal;
  const knessetCursor =
    knessetWindow > 0 ? activeKnessetIndex % knessetWindow : -1;

  /**
   * Reading surfaces hold their own desk's rotation while a pointer or
   * keyboard focus is on them - scoped so resting the cursor on the map
   * never freezes the Knesset feed, or the other way round.
   */
  const holdMuni = useMemo(() => holdHandlers(setMuniPaused), []);
  const holdKnesset = useMemo(() => holdHandlers(setKnessetPaused), []);

  useEffect(
    () =>
      rotate(municipalWindow, muniPaused, MUNI_ROTATION_MS, setActiveMuniIndex),
    [municipalWindow, muniPaused],
  );

  useEffect(
    () =>
      rotate(
        knessetWindow,
        knessetPaused,
        KNESSET_ROTATION_MS,
        setActiveKnessetIndex,
      ),
    [knessetWindow, knessetPaused],
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root || shouldReduceMotion) return;

    let cancelled = false;
    let revertGsap = () => {};

    // Every target below lives in the question scene, which the thesis-only
    // intro does not render.
    const animeScope = createScope({ root }).add(() => {
      if (thesisOnly) return;

      animate("[data-intro-logo]", {
        translateY: [-18, 0],
        opacity: [0, 1],
        duration: 900,
        ease: "outExpo",
      });

      animate("[data-intro-locale]", {
        translateY: [-12, 0],
        opacity: [0, 1],
        delay: 240,
        duration: 780,
        ease: "outExpo",
      });

      animate("[data-intro-social]", {
        translateY: [8, 0],
        opacity: [0, 1],
        delay: stagger(80, { start: 540 }),
        duration: 650,
        ease: "outExpo",
      });

      animate("[data-question-line]", {
        translateY: ["105%", "0%"],
        opacity: [0, 1],
        delay: stagger(90, { start: 120 }),
        duration: 850,
        ease: "outExpo",
      });

      animate("[data-question-action]", {
        translateY: [12, 0],
        opacity: [0, 1],
        delay: stagger(90, { start: 520 }),
        duration: 720,
        ease: "outExpo",
      });

      animate("[data-cursor]", {
        scaleX: [0.15, 1],
        opacity: [0.35, 1],
        duration: 1400,
        alternate: true,
        loop: true,
        ease: "inOutSine",
      });
    });

    async function buildScrollStory() {
      const [gsapModule, scrollTriggerModule] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger.js"),
      ]);
      const scopeRoot = rootRef.current;
      if (cancelled || !scopeRoot) return;

      const gsap = gsapModule.gsap;
      const ScrollTrigger = scrollTriggerModule.ScrollTrigger;
      gsap.registerPlugin(ScrollTrigger);

      const context = gsap.context(() => {
        const question = '[data-scene="question"]';
        const comparison = '[data-scene="comparison"]';
        const thesis = '[data-scene="thesis"]';

        // Depth parallax: the closer a mark floats, the further it travels
        // under continued scroll, so the field reads as a camera move rather
        // than a flat layout. Desktop only - below 1100px the metrics
        // collapse into a static grid that must not shear.
        const addLedgerDrift = (timeline: gsap.core.Timeline, at: number) => {
          if (!window.matchMedia("(min-width: 1101px)").matches) return;
          timeline.to(
            "[data-thesis-metric], [data-thesis-dust]",
            {
              y: (_index: number, target: Element) =>
                -78 * Number((target as HTMLElement).dataset.depth ?? "0.5"),
              duration: 0.85,
              ease: "none",
            },
            at,
          );
        };

        // One act, so there is nothing to slide off first: the thesis is
        // already on stage and the scroll only plays its own reveal. The
        // runway shrinks to match (see .thesisOnly in the stylesheet) -
        // 480svh of scrub for a single scene would read as a stuck page.
        if (thesisOnly) {
          gsap.set(thesis, {
            visibility: "visible",
            yPercent: 0,
            pointerEvents: "auto",
          });
          gsap.set("[data-thesis-ledger]", { yPercent: 34, opacity: 0 });

          const soloStory = gsap
            .timeline({
              defaults: { ease: "power3.inOut" },
              scrollTrigger: {
                trigger: scopeRoot,
                start: "top top",
                end: "70% bottom",
                scrub: 0.45,
                invalidateOnRefresh: true,
              },
            })
            .fromTo(
              "[data-thesis-metric]",
              { y: -22, opacity: 0 },
              {
                y: 0,
                opacity: (_index: number, target: Element) =>
                  0.38 +
                  0.62 * Number((target as HTMLElement).dataset.depth ?? "0.5"),
                stagger: 0.07,
                duration: 0.5,
                ease: "power3.out",
              },
              0,
            )
            .to(
              "[data-thesis-rule]",
              {
                scaleX: 1,
                duration: 0.58,
                ease: "power3.inOut",
              },
              0.08,
            )
            .to(
              "[data-thesis-ledger]",
              {
                yPercent: 0,
                opacity: 1,
                duration: 0.76,
                ease: "power3.out",
              },
              0.08,
            )
            .to(
              "[data-paper-wash]",
              {
                opacity: 1,
                duration: 0.5,
              },
              0.95,
            );

          // After the last staggered entrance settles, so the two never fight
          // over the same transform.
          addLedgerDrift(soloStory, 1.15);

          ScrollTrigger.refresh();
          return;
        }

        gsap.set(question, { visibility: "visible" });
        gsap.set(comparison, {
          visibility: "hidden",
          yPercent: 100,
          pointerEvents: "none",
        });
        gsap.set(thesis, {
          visibility: "hidden",
          yPercent: 100,
          pointerEvents: "none",
        });
        gsap.set('[data-panel="map"]', { xPercent: -112 });
        gsap.set('[data-panel="signals"]', { xPercent: 112 });
        gsap.set("[data-map-shell]", { scale: 0.94 });
        gsap.set("[data-thesis-ledger]", { yPercent: 34, opacity: 0 });

        const story = gsap
          .timeline({
            defaults: { ease: "power3.inOut" },
            scrollTrigger: {
              trigger: scopeRoot,
              start: "top top",
              end: "70% bottom",
              scrub: 0.45,
              invalidateOnRefresh: true,
            },
          })
          .to(
            '[data-question-sentence="top"]',
            {
              xPercent: 125,
              yPercent: -12,
              duration: 0.68,
            },
            0.66,
          )
          .to(
            '[data-question-sentence="bottom"]',
            {
              xPercent: -125,
              yPercent: 12,
              duration: 0.68,
            },
            0.66,
          )
          .to(
            "[data-question-actions]",
            {
              xPercent: -140,
              yPercent: 18,
              duration: 0.62,
            },
            0.68,
          )
          .to(
            "[data-intro-logo]",
            {
              xPercent: 145,
              yPercent: 24,
              duration: 0.62,
            },
            0.7,
          )
          .to(
            "[data-intro-locale]",
            {
              yPercent: -220,
              opacity: 0,
              duration: 0.5,
            },
            0.7,
          )
          .to(
            "[data-scroll-cue]",
            {
              yPercent: 220,
              duration: 0.5,
            },
            0.74,
          )
          .to(
            "[data-hero-map]",
            {
              scale: 1.14,
              yPercent: -18,
              duration: 0.72,
            },
            0.64,
          )
          .set(question, { visibility: "hidden" }, 1.36)
          .set(
            comparison,
            {
              visibility: "visible",
              pointerEvents: "auto",
            },
            1.08,
          )
          .to(
            comparison,
            {
              yPercent: 0,
              duration: 0.82,
            },
            1.08,
          )
          .to(
            '[data-panel="map"]',
            {
              xPercent: 0,
              duration: 0.82,
            },
            1.14,
          )
          .to(
            '[data-panel="signals"]',
            {
              xPercent: 0,
              duration: 0.82,
            },
            1.14,
          )
          .to(
            "[data-map-shell]",
            {
              scale: 1,
              duration: 0.7,
            },
            1.28,
          )
          .fromTo(
            "[data-signal-row]",
            {
              xPercent: 90,
            },
            {
              xPercent: 0,
              stagger: 0.08,
              duration: 0.56,
              ease: "power3.out",
            },
            1.34,
          )
          .to(
            '[data-panel="map"]',
            {
              yPercent: -2,
              scale: 1.025,
              duration: 0.95,
              ease: "none",
            },
            1.92,
          )
          .to(
            '[data-panel="signals"]',
            {
              yPercent: 4,
              duration: 0.95,
              ease: "none",
            },
            1.92,
          )
          .to(
            '[data-panel="map"]',
            {
              xPercent: -118,
              yPercent: -7,
              duration: 0.68,
              ease: "power3.in",
            },
            2.88,
          )
          .to(
            '[data-panel="signals"]',
            {
              xPercent: 118,
              yPercent: 9,
              duration: 0.68,
              ease: "power3.in",
            },
            2.88,
          )
          .set(
            thesis,
            {
              visibility: "visible",
              pointerEvents: "auto",
            },
            3.02,
          )
          .to(
            thesis,
            {
              yPercent: 0,
              duration: 0.78,
              ease: "power4.out",
            },
            3.02,
          )
          .set(
            comparison,
            {
              visibility: "hidden",
              pointerEvents: "none",
            },
            3.58,
          )
          .to(
            "[data-thesis-rule]",
            {
              scaleX: 1,
              duration: 0.58,
              ease: "power3.inOut",
            },
            3.38,
          )
          .fromTo(
            "[data-thesis-metric]",
            { y: -22, opacity: 0 },
            {
              y: 0,
              // Lands on the same value as the stylesheet's
              // calc(0.38 + var(--depth) * 0.62) so the inline style GSAP
              // leaves behind agrees with the static depth look.
              opacity: (_index: number, target: Element) =>
                0.38 +
                0.62 * Number((target as HTMLElement).dataset.depth ?? "0.5"),
              stagger: 0.07,
              duration: 0.5,
              ease: "power3.out",
            },
            3.3,
          )
          .to(
            "[data-thesis-ledger]",
            {
              yPercent: 0,
              opacity: 1,
              duration: 0.76,
              ease: "power3.out",
            },
            3.38,
          )
          .to(
            "[data-paper-wash]",
            {
              opacity: 1,
              duration: 0.5,
            },
            4.12,
          );

        // After the last staggered entrance settles (3.3 + stagger + 0.5) so
        // the two never fight over the same transform.
        addLedgerDrift(story, 4.35);

        ScrollTrigger.refresh();
      }, scopeRoot);

      revertGsap = () => context.revert();
    }

    void buildScrollStory();

    return () => {
      cancelled = true;
      animeScope.revert();
      revertGsap();
    };
  }, [shouldReduceMotion, thesisOnly]);

  return (
    <section
      ref={rootRef}
      className={`${styles.cinematic} ${shouldReduceMotion ? styles.reduced : ""} ${
        thesisOnly ? styles.thesisOnly : ""
      }`}
      aria-label={t.sectionAria}
    >
      <div className={styles.stage} data-cinematic-stage>
        <div className={styles.paperTexture} aria-hidden />
        <div className={styles.paperWash} data-paper-wash aria-hidden />

        {/* The two acts that argue the case before showing the evidence. The
            homepage skips straight to the thesis; see IntroStory. */}
        {!thesisOnly && (
          <>
        <article
          className={`${styles.scene} ${styles.questionScene}`}
          data-scene="question"
        >
          <div className={styles.heroMap} data-hero-map aria-hidden>
            <svg
              className={styles.heroMapSvg}
              viewBox={MAP_VIEWBOX}
              preserveAspectRatio="xMidYMid meet"
            >
              <path className={styles.mapOutline} d={ISRAEL_MAP_PATH} />
              {mapSignals.map(({ signal, point }) => (
                <g
                  className={styles.mapPin}
                  data-active={
                    activeMunicipalSignal?.id === signal.id || undefined
                  }
                  transform={`translate(${point.x} ${point.y})`}
                  key={`hero-${signal.id}`}
                >
                  <circle className={styles.pinCore} r="5" />
                </g>
              ))}
            </svg>
          </div>

          <Link
            className={styles.localeSwitch}
            href={localePath(otherLocale)}
            hrefLang={otherLocale}
            lang={otherLocale}
            aria-label={t.localeSwitchAria}
            data-intro-locale
          >
            {t.localeSwitchLabel}
          </Link>

          <div className={styles.introBrand} data-intro-logo>
            <div className={styles.introLogo} aria-label={t.brandName}>
              {t.brandName}<span>.</span>
            </div>
            <nav
              className={styles.introSocials}
              aria-label={t.socialsAria}
            >
              {INTRO_SOCIALS.map((social) => (
                <a
                  data-intro-social
                  href={social.href}
                  key={social.label}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                >
                  <svg viewBox="0 0 24 24" aria-hidden>
                    {social.icon === "instagram" && (
                      <>
                        <rect
                          x="3.1"
                          y="3.1"
                          width="17.8"
                          height="17.8"
                          rx="5.1"
                        />
                        <circle cx="12" cy="12" r="4.1" />
                        <circle
                          cx="17.45"
                          cy="6.65"
                          r="1"
                          className={styles.socialFill}
                        />
                      </>
                    )}
                    {social.icon === "facebook" && (
                      <path
                        className={styles.socialFill}
                        d="M13.6 21v-8h2.75l.42-3.15H13.6V7.83c0-.91.26-1.53 1.6-1.53h1.7V3.48c-.3-.04-1.3-.13-2.48-.13-2.46 0-4.15 1.5-4.15 4.27v2.23H7.5V13h2.77v8h3.33Z"
                      />
                    )}
                    {social.icon === "x" && (
                      <path
                        className={styles.socialFill}
                        d="M4.2 3.5h4.55l4.2 5.56 4.86-5.56h1.98l-5.94 6.8 6.2 8.2H15.5l-4.65-6.15-5.38 6.15H3.5l6.45-7.38L4.2 3.5Zm3.58 1.4H6.95l9.55 12.2h.84L7.78 4.9Z"
                      />
                    )}
                  </svg>
                </a>
              ))}
            </nav>

          </div>

          <div className={styles.questionCopy} data-question-copy>
            <div className={styles.questionLead}>
              <h1 className={styles.question}>
                <span
                  className={`${styles.questionSentence} ${styles.questionTopRight}`}
                  data-question-sentence="top"
                >
                  <i data-question-line>
                    {t.q1pre}<mark>{t.q1mark}</mark>{t.q1mid}<em>{t.q1em}</em>{t.q1end}
                  </i>
                </span>
                <span
                  className={`${styles.questionSentence} ${styles.questionBottomLeft}`}
                  data-question-sentence="bottom"
                >
                  <i data-question-line>
                    {t.q2pre}<mark>{t.q2mark}</mark>{t.q2mid}<strong>{t.q2strong}</strong>
                  </i>
                </span>
              </h1>

              <div className={styles.questionActions} data-question-actions>
                <button
                  type="button"
                  className={styles.questionPrimary}
                  data-question-action
                  onClick={advanceToLiveMap}
                >
                  {t.primaryCta}
                  <span aria-hidden>↓</span>
                </button>
                <Link
                  href={`${localePrefix(locale)}/explore`}
                  className={styles.questionSecondary}
                  data-question-action
                >
                  {t.secondaryCta} <span aria-hidden>{t.backGlyph}</span>
                </Link>
              </div>
            </div>

            <dl className={styles.questionStats} aria-live="polite">
              {[
                [t.participantCountLabel, publicLedger.peopleInvolved],
                [t.municipalDecisionsLabel, publicLedger.municipalTopics],
                [t.nationalDecisionsLabel, publicLedger.knessetTopics],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <dt>{label}</dt>
                  <dd>
                    {typeof value === "number" ? he(value) : t.measuringNow}
                  </dd>
                </div>
              ))}
            </dl>

            <div className={styles.scrollCue} data-scroll-cue aria-hidden>
              <motion.span
                animate={shouldReduceMotion ? undefined : { y: [0, 5, 0] }}
                transition={{
                  duration: 1.8,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                {t.scrollCue}
              </motion.span>
              <i data-cursor />
            </div>
          </div>
        </article>

        <article
          className={`${styles.scene} ${styles.comparisonScene}`}
          data-scene="comparison"
        >
          <div className={styles.comparison} data-comparison-inner>
            <section className={styles.mapPanel} data-panel="map">
              <header className={styles.panelHeader}>
                <div>
                  <span>MUNICIPAL TOCS / LIVE MAP</span>
                  <h2>{t.muniPanelTitle}</h2>
                </div>
                <b className={styles.scanning}>
                  LIVE {municipalSignals.length}
                  <i />
                </b>
              </header>

              <div className={styles.mapShell} data-map-shell {...holdMuni}>
                <div className={styles.mapCanvas}>
                  <svg
                    className={styles.israelMap}
                    viewBox={MAP_VIEWBOX}
                    preserveAspectRatio="xMidYMid meet"
                    role="img"
                    aria-label={t.mapAria}
                  >
                    <path className={styles.mapOutline} d={ISRAEL_MAP_PATH} />

                    {activeMunicipal && (
                      <line
                        className={styles.mapSignalLeader}
                        x1={activeMunicipal.point.x}
                        y1={activeMunicipal.point.y}
                        x2={activeMunicipal.point.x + 26}
                        y2={activeMunicipal.point.y}
                      />
                    )}

                    {mapSignals.map(({ signal, point }) => {
                      const isActive =
                        activeMunicipalSignal?.municipality ===
                        signal.municipality;
                      // Pin size carries the heat, so the map itself ranks.
                      const radius = 4 + (heatOf(signal) / 100) * 3;
                      // Labels sit above the pin (below, near the top edge):
                      // centred, so Hebrew bidi can't flip them onto the map.
                      const labelBelow = point.y < 60;
                      return (
                        <g
                          className={styles.mapPin}
                          data-active={isActive || undefined}
                          transform={`translate(${point.x} ${point.y})`}
                          key={signal.id}
                          role="button"
                          tabIndex={0}
                          aria-label={`${signal.municipality} - ${signal.title}`}
                          onClick={() => {
                            const topicIndex = placedMunicipalSignals.findIndex(
                              ({ signal: placed }) =>
                                placed.municipality === signal.municipality,
                            );
                            if (topicIndex >= 0) setActiveMuniIndex(topicIndex);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              const topicIndex =
                                placedMunicipalSignals.findIndex(
                                  ({ signal: placed }) =>
                                    placed.municipality === signal.municipality,
                                );
                              if (topicIndex >= 0)
                                setActiveMuniIndex(topicIndex);
                            }
                          }}
                        >
                          <circle className={styles.pinRadar} r={radius + 4} />
                          <circle className={styles.pinCore} r={radius} />
                          {isActive && (
                            <text
                              y={labelBelow ? radius + 17 : -(radius + 8)}
                              textAnchor="middle"
                            >
                              {signal.municipality}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </svg>

                  <AnimatePresence mode="wait" initial={false}>
                    {activeMunicipalSignal && activeMunicipal && (
                      <motion.aside
                        className={`${styles.tocDispatch} ${styles.desktopDispatch}`}
                        key={activeMunicipalSignal.id}
                        style={dispatchPosition(activeMunicipal.point)}
                        initial={{ x: -28 }}
                        animate={{ x: 0 }}
                        exit={{ x: 28 }}
                        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        aria-live="polite"
                      >
                        <MunicipalDispatchContent
                          locale={locale}
                          signal={activeMunicipalSignal}
                          paused={muniPaused}
                          t={t}
                        />
                      </motion.aside>
                    )}
                  </AnimatePresence>
                </div>

                <AnimatePresence mode="wait" initial={false}>
                  {activeMunicipalSignal && (
                    <motion.aside
                      className={`${styles.tocDispatch} ${styles.mobileDispatch}`}
                      key={`mobile-${activeMunicipalSignal.id}`}
                      initial={{ y: 24 }}
                      animate={{ y: 0 }}
                      exit={{ y: 24 }}
                      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                      aria-live="polite"
                    >
                      <MunicipalDispatchContent
                        locale={locale}
                        signal={activeMunicipalSignal}
                        paused={muniPaused}
                        t={t}
                      />
                    </motion.aside>
                  )}
                </AnimatePresence>

                <div className={styles.mapLegend}>
                  <span>
                    <i />
                    {t.legendActive}
                  </span>
                  <span>
                    {mapSignals.length} {t.legendAreas}
                  </span>
                </div>
              </div>
            </section>

            <section className={styles.signalPanel} data-panel="signals">
              <header className={styles.panelHeader}>
                <div>
                  <span>KNESSET TOCS / LIVE FEED</span>
                  <h2>{t.knessetPanelTitle}</h2>
                </div>
                <b>{knessetSignals.length.toLocaleString("he-IL")}</b>
              </header>

              <p className={styles.signalLede}>{t.knessetLede}</p>

              <ol
                className={styles.signalList}
                aria-live="polite"
                {...holdKnesset}
              >
                {knessetSignals.slice(0, 6).map((signal, index) => {
                  const evidence = knessetEvidence[signal.id];
                  const ranking = evidence?.ranking;
                  const official = evidence?.official;
                  const displayTitle = structureKnessetTitle(
                    signal.title,
                    official?.itemType,
                    locale,
                  );

                  return (
                    <li
                      data-active={index === knessetCursor || undefined}
                      data-signal-row
                      key={signal.id}
                      onMouseEnter={() => setActiveKnessetIndex(index)}
                    >
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <div>
                        <div className={styles.signalHeading}>
                          <div className={styles.signalTitleMeta}>
                            <span className={styles.signalKind}>
                              {displayTitle.kind}
                            </span>
                            {displayTitle.tags.map((tag) => (
                              <span key={tag}>{tag}</span>
                            ))}
                          </div>
                          <b className={styles.signalTitle}>
                            <Link
                              href={voteHref(signal.id, locale)}
                              title={signal.title}
                              aria-label={signal.title}
                            >
                              {displayTitle.headline}
                            </Link>
                          </b>
                        </div>
                        <em className={styles.signalMetrics}>
                          {signal.source ? (
                            <>
                              <b className={styles.rowHeat}>
                                🔥 {signal.source.hotness}°
                              </b>
                              {topReactions(signal.source.reactions, 6).map(
                                ({ kind, glyph, total }) => (
                                  <span key={kind}>
                                    {glyph} {he(total)}
                                  </span>
                                ),
                              )}
                              <span>💬 {he(signal.source.commentsCount)}</span>
                              <span>
                                {he(signal.source.postCount)} {t.postsWord}
                              </span>
                            </>
                          ) : (
                            <>
                              {ranking && (
                                <b className={styles.rowHeat}>
                                  🔥 {ranking.hotness}°
                                </b>
                              )}
                              {ranking?.relevance != null && (
                                <span>
                                  {t.relevanceLabel} {ranking.relevance}
                                </span>
                              )}
                              {ranking?.media != null && (
                                <span>
                                  {t.coverageLabel} {ranking.media}
                                </span>
                              )}
                              {official?.sessionDate && (
                                <span>
                                  {officialDate(official.sessionDate)}
                                </span>
                              )}
                            </>
                          )}
                          {signal.participantCount > 0 && (
                            <span>
                              {he(signal.participantCount)} {t.voted}
                            </span>
                          )}
                        </em>

                        <p className={styles.signalSummary}>
                          {proposalBrief(signal, t, evidence)}
                        </p>

                        {official?.summary && ranking?.rationale && (
                          <p className={styles.signalContext}>
                            {ranking.rationale}
                          </p>
                        )}

                        <div className={styles.signalLinks}>
                          <Link href={voteHref(signal.id, locale)}>
                            {t.knessetVoteCta}
                          </Link>
                          {official?.docUrl && (
                            <a
                              href={official.docUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {t.officialDocLink}
                            </a>
                          )}
                          {ranking?.mediaRefs[0] && (
                            <a
                              href={ranking.mediaRefs[0]}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {t.mediaSourceLink}
                            </a>
                          )}
                        </div>
                      </div>
                      <i />
                    </li>
                  );
                })}
                {knessetSignals.length === 0 && (
                  <li className={styles.signalEmpty}>{t.connecting}</li>
                )}
              </ol>

              <Link
                className={styles.signalCta}
                href={`${localePrefix(locale)}/explore`}
              >
                {t.fullAgendaCta}
                <i aria-hidden>{t.backGlyph}</i>
              </Link>

              <footer className={styles.scanFooter}>
                <span>
                  <i />
                  LIVE INGEST
                </span>
                <span suppressHydrationWarning>
                  DB / ACTIVE TOCS ·{" "}
                  {lastSignalSync
                    ? lastSignalSync.toLocaleTimeString("he-IL", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: false,
                      })
                    : "SYNCING"}
                </span>
              </footer>
            </section>
          </div>
        </article>
          </>
        )}

        <article
          className={`${styles.scene} ${styles.thesisScene}`}
          data-scene="thesis"
        >
          <div className={styles.thesisCopy} data-thesis-copy>
            <span className={styles.thesisKicker}>{t.thesisKicker}</span>
            <h2 className={styles.thesisTitle}>
              {t.thesisA}
              <span>{t.thesisB}</span>
              <em>{t.thesisC}</em>
            </h2>
            <span className={styles.thesisRule} data-thesis-rule aria-hidden />
            <p className={styles.thesisLede}>{t.thesisLede}</p>
          </div>

          <CivicSignalMap
            stats={publicLedger}
            mapSignals={mapSignals}
            bestCity={bestCivicCity}
            pressingKnesset={pressingKnesset}
            t={t}
          />
        </article>
      </div>
    </section>
  );
}
