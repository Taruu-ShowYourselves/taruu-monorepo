/**
 * Every word the municipality profile prints, in both editions.
 *
 * Kept out of the page so the tile component can be typed against the same
 * object the page hands it, rather than taking a dozen loose string props.
 */

import type { LocalAuthorityKind } from '@sync/shared/contracts';
import type { Locale } from '@/lib/i18n';

/**
 * The Latin half of a kicker, shared by both editions.
 *
 * The Hebrew edition sets a Hebrew kicker against a Latin one - `טור ריק · NIL`
 * is the same device - so the Latin names live once here rather than being
 * transliterated twice.
 */
const KIND_LATIN: Record<LocalAuthorityKind, string> = {
  municipality: 'MUNICIPALITY',
  local_council: 'LOCAL COUNCIL',
  regional_council: 'REGIONAL COUNCIL',
  settlement: 'SETTLEMENT',
};

/** Hoisted out of COPY so the kicker can set it against its Latin twin. */
const KIND_HE: Record<LocalAuthorityKind, string> = {
  municipality: 'עירייה',
  local_council: 'מועצה מקומית',
  regional_council: 'מועצה אזורית',
  settlement: 'יישוב',
};

export interface MunicipalityCopy {
  /** BCP 47 tag for dates and grouped figures. */
  dateLocale: string;
  notFoundTitle: string;
  metaTitle: (name: string) => string;
  metaDescription: (name: string) => string;

  // ---- Furniture ----
  crumbHome: string;
  crumbDesk: string;
  /**
   * What kind of authority this page is about. Not every authority is a city:
   * a regional council and the settlements inside it get the same page, and
   * printing "municipality" over all four would be plainly wrong.
   */
  kicker: (kind: LocalAuthorityKind) => string;
  /** The kind in running text, for lists that mix kinds. */
  kindLabel: Record<LocalAuthorityKind, string>;
  standfirst: (name: string) => string;
  openTopicCta: (name: string) => string;
  deskCta: string;
  arrow: string;

  // ---- The plate ----
  plateLabel: string;
  plateRank: (rank: number, total: number) => string;
  plateUnranked: string;
  scaleMin: string;
  scaleMax: string;

  // ---- Index band ----
  railResidents: string;
  railResidentsSourced: string;
  railResidentsUnknown: string;
  railPlatform: string;
  railPlatformNote: (pct: string) => string;
  railPlatformNoReach: string;
  railVoters: string;
  railVotersNote: (pct: string) => string;
  railVotersNone: string;
  railOpen: string;
  railOpenNote: string;
  railDecided: string;
  railDecidedNote: string;
  railBallots: string;
  railBallotsNote: string;

  // ---- Civic index ----
  indexTitle: string;
  indexNote: string;
  scoreOverall: string;
  scoreEngagement: string;
  scoreCooperation: string;
  scoreSatisfaction: string;
  methodOverall: string;
  methodEngagement: string;
  methodCooperation: string;
  methodSatisfaction: string;
  medianNote: (value: string) => string;
  medianNone: string;
  unmeasured: string;

  // ---- Tempo band ----
  tempoParticipation: string;
  tempoParticipationCaption: (voters: string, residents: string) => string;
  tempoTime: string;
  tempoTimeCaption: string;
  tempoSatisfaction: string;
  tempoSatisfactionCaption: (count: string) => string;
  tempoNoData: string;
  tempoNoRatings: string;
  minutes: (n: number) => string;
  hours: (n: number) => string;
  days: (n: number) => string;

  // ---- Ballots ----
  votesTitle: string;
  votesNote: string;
  tabLive: string;
  tabTopics: string;
  tabClosed: string;
  statusLive: string;
  statusClosed: string;
  statusFresh: string;
  decided: (option: string) => string;
  ballots: (n: string) => string;
  opened: string;
  closes: string;
  closed: string;
  voteCta: string;
  voteFirstCta: string;
  resultCta: string;
  emptyKicker: string;
  emptyLiveTitle: string;
  emptyLiveBody: (name: string) => string;
  emptyTopicsTitle: string;
  emptyTopicsBody: (name: string) => string;
  emptyClosedTitle: string;
  emptyClosedBody: (name: string) => string;

  // ---- Other editions ----
  stripTitle: string;
  stripNote: string;
  stripTopics: (n: number) => string;

  // ---- Closing band ----
  closingTitle: string;
  closingBody: (name: string) => string;
}

export const COPY: Record<Locale, MunicipalityCopy> = {
  he: {
    dateLocale: 'he-IL',
    notFoundTitle: 'רשות לא נמצאה | תַּרְאוּ',
    metaTitle: (name) => `${name} · פרופיל רשות | תַּרְאוּ`,
    metaDescription: (name) =>
      `כל ההצבעות הפתוחות והסגורות ב${name}, המדד האזרחי של הרשות והשוואה לשאר הארץ. נתונים מאומתים, שקופים לכולם.`,

    crumbHome: 'תַּרְאוּ',
    crumbDesk: 'הרשויות',
    kicker: (kind) => `${KIND_HE[kind]} · ${KIND_LATIN[kind]}`,
    kindLabel: KIND_HE,
    standfirst: (name) =>
      `מה פתוח להצבעה ב${name} עכשיו, כמה מהעיר כבר כאן, ואיך היא נמדדת מול שאר הרשויות. כל מספר בעמוד הזה נספר מהקולות עצמם.`,
    openTopicCta: (name) => `פתחו נושא ב${name}`,
    deskCta: 'לדסק המלא',
    arrow: '←',

    plateLabel: 'ציון אזרחי כולל',
    plateRank: (rank, total) => `מקום ${rank} מתוך ${total} רשויות נמדדות`,
    plateUnranked: 'טרם נמדד. הציון נפתח עם ההצבעה הראשונה שנספרת ברשות.',
    scaleMin: '100−',
    scaleMax: '100+',

    railResidents: 'תושבים',
    railResidentsSourced: 'נתון אוכלוסייה רשמי',
    railResidentsUnknown: 'אין עדיין נתון אוכלוסייה ממקור מצוטט',
    railPlatform: 'רשומים כאן',
    railPlatformNote: (pct) => `${pct} מתושבי הרשות`,
    railPlatformNoReach: 'שיעור החדירה יימדד עם פרסום נתון האוכלוסייה',
    railVoters: 'מצביעים פעילים',
    railVotersNote: (pct) => `${pct} מהנרשמים כבר הצביעו`,
    railVotersNone: 'עוד לא נספר קול ברשות',
    railOpen: 'נושאים פתוחים',
    railOpenNote: 'הצבעות שאפשר להשפיע עליהן עכשיו',
    railDecided: 'הוכרעו',
    railDecidedNote: 'הצבעות שנסגרו ותוצאותיהן פומביות',
    railBallots: 'קולות שנספרו',
    railBallotsNote: 'סך הקולות בכל הצבעות הרשות',

    indexTitle: 'המדד האזרחי',
    indexNote:
      'כל הציונים על אותו סולם, 100− עד 100+, כדי שאפשר יהיה להשוות ביניהם במבט אחד. הקו האנכי הכהה על הפס הוא החציון הארצי. ציון שטרם נמדד מודפס כמקף — אף פעם לא כאפס.',
    scoreOverall: 'ציון כולל',
    scoreEngagement: 'מעורבות',
    scoreCooperation: 'הסכמה',
    scoreSatisfaction: 'שביעות רצון',
    methodOverall: 'ממוצע משוקלל של הצירים שנמדדו בפועל, בלי להחשיב ציר חסר כאפס.',
    methodEngagement: 'חצי הישג הרשמה מול האוכלוסייה, חצי שיעור הנרשמים שבאמת הצביעו.',
    methodCooperation:
      'לכל נושא, פער בעד־נגד חלקי סך הקולות. עיר שמסכימה עם עצמה עולה, עיר חצויה יורדת.',
    methodSatisfaction: 'הדירוג 1–5 שתושבים נותנים לרשות בהרשמה.',
    medianNote: (value) => `חציון ארצי ${value}`,
    medianNone: 'אין עדיין חציון ארצי לציר הזה',
    unmeasured: 'טרם נמדד',

    tempoParticipation: 'שיעור השתתפות',
    tempoParticipationCaption: (voters, registered) =>
      `${voters} מצביעים מתוך ${registered} נרשמים בפלטפורמה`,
    tempoTime: 'זמן עד הצבעה',
    tempoTimeCaption: 'ממוצע מרגע פתיחת הצבעה ועד מתן הקול',
    tempoSatisfaction: 'שביעות רצון ממוצעת',
    tempoSatisfactionCaption: (count) => `${count} תושבים דירגו את הרשות`,
    tempoNoData: 'אין עדיין נתוני הצבעה ברשות',
    tempoNoRatings: 'אין עדיין דירוגים. הדירוג נאסף בהרשמה',
    minutes: (n) => `${n} דק׳`,
    hours: (n) => `${n} שע׳`,
    days: (n) => `${n} ימים`,

    votesTitle: 'על השולחן',
    votesNote:
      'כל נושא כאן נפתח מדיון אמיתי של תושבים. ההצבעה מאומתת מיקום וזהות, והתוצאה נספרת בפומבי.',
    tabLive: 'הצבעות חיות',
    tabTopics: 'נושאים פתוחים',
    tabClosed: 'הוכרעו',
    statusLive: 'חיה',
    statusClosed: 'הוכרעה',
    statusFresh: 'עדיין בלי קולות',
    decided: (option) => `הוכרע: ${option}`,
    ballots: (n) => `${n} קולות מאומתים`,
    opened: 'נפתחה',
    closes: 'נסגרת',
    closed: 'נסגרה',
    voteCta: 'להצבעה',
    voteFirstCta: 'הצביעו ראשונים',
    resultCta: 'לתוצאה המלאה',
    emptyKicker: 'טור ריק · NIL',
    emptyLiveTitle: 'עוד לא נספר קול',
    emptyLiveBody: (name) =>
      `אף הצבעה ב${name} לא קיבלה עדיין קול. הנושאים שמחכים לקול הראשון נמצאים בלשונית «נושאים פתוחים».`,
    emptyTopicsTitle: 'השולחן ריק',
    emptyTopicsBody: (name) =>
      `אין כרגע נושא פתוח ב${name}. נושא נפתח כשתושב מעלה אותו — וזה יכול להיות אתם.`,
    emptyClosedTitle: 'טרם הוכרעה הצבעה',
    emptyClosedBody: (name) =>
      `עוד לא נסגרה הצבעה ב${name}. כשתיסגר, התוצאה תודפס כאן במלואה — כולל פילוח הקולות.`,

    stripTitle: 'רשויות נוספות',
    stripNote: 'לפי הציון האזרחי הכולל. רשויות שטרם נמדדו בסוף הרשימה.',
    stripTopics: (n) => (n === 1 ? 'נושא אחד פתוח' : `${n} נושאים פתוחים`),

    closingTitle: 'מה שלא מצביעים עליו — מחליטים במקומכם.',
    closingBody: (name) =>
      `כל נושא שנפתח ב${name} נספר, נחתם ונשלח למועצה עם מספר הקולות שמאחוריו. פתיחת נושא לוקחת שתי דקות.`,
  },

  en: {
    dateLocale: 'en-GB',
    notFoundTitle: 'Municipality not found | Taruu',
    metaTitle: (name) => `${name} · municipality profile | Taruu`,
    metaDescription: (name) =>
      `Every open and closed vote in ${name}, its civic index, and how it compares with the rest of the country. Verified figures, transparent to everyone.`,

    crumbHome: 'Taruu',
    crumbDesk: 'Municipalities',
    kicker: (kind) => `${KIND_LATIN[kind]} PROFILE`,
    kindLabel: {
      municipality: 'Municipality',
      local_council: 'Local council',
      regional_council: 'Regional council',
      settlement: 'Settlement',
    },
    standfirst: (name) =>
      `What is open for a vote in ${name} right now, how much of the city is already here, and how it measures against every other municipality. Every figure on this page is counted from the ballots themselves.`,
    openTopicCta: (name) => `Open a topic in ${name}`,
    deskCta: 'To the full desk',
    arrow: '→',

    plateLabel: 'Overall civic score',
    plateRank: (rank, total) => `Rank ${rank} of ${total} measured authorities`,
    plateUnranked: 'Not measured yet. The score opens with the first ballot counted here.',
    scaleMin: '−100',
    scaleMax: '+100',

    railResidents: 'Residents',
    railResidentsSourced: 'Official population figure',
    railResidentsUnknown: 'No sourced population figure yet',
    railPlatform: 'Registered here',
    railPlatformNote: (pct) => `${pct} of the municipality`,
    railPlatformNoReach: 'Reach is measurable once a population figure is published',
    railVoters: 'Active voters',
    railVotersNote: (pct) => `${pct} of those registered have voted`,
    railVotersNone: 'No ballot counted here yet',
    railOpen: 'Open topics',
    railOpenNote: 'Votes you can still move',
    railDecided: 'Decided',
    railDecidedNote: 'Closed votes with public results',
    railBallots: 'Ballots counted',
    railBallotsNote: 'Across every vote in this municipality',

    indexTitle: 'The civic index',
    indexNote:
      'Every score runs the same −100 to +100 scale, so they can be compared at a glance. The dark tick on each track is the national median. A score that has not been measured prints as a dash — never as a zero.',
    scoreOverall: 'Overall',
    scoreEngagement: 'Engagement',
    scoreCooperation: 'Agreement',
    scoreSatisfaction: 'Satisfaction',
    methodOverall: 'Weighted mean of whichever axes were actually measured; a missing axis is not a zero.',
    methodEngagement: 'Half reach - sign-ups against population; half activity - registered residents who have voted.',
    methodCooperation:
      'Per topic, the for/against gap over the total. A city that agrees with itself rises; a split one falls.',
    methodSatisfaction: 'The 1-5 rating residents give their municipality at sign-up.',
    medianNote: (value) => `National median ${value}`,
    medianNone: 'No national median on this axis yet',
    unmeasured: 'Not measured yet',

    tempoParticipation: 'Participation rate',
    tempoParticipationCaption: (voters, residents) =>
      `${voters} voters out of ${residents} registered residents`,
    tempoTime: 'Time to vote',
    tempoTimeCaption: 'Average from a vote opening to a ballot cast',
    tempoSatisfaction: 'Average satisfaction',
    tempoSatisfactionCaption: (count) => `${count} residents rated the municipality`,
    tempoNoData: 'No voting data here yet',
    tempoNoRatings: 'No ratings yet. Ratings are collected at sign-up',
    minutes: (n) => `${n} min`,
    hours: (n) => `${n} hr`,
    days: (n) => `${n} days`,

    votesTitle: 'On the table',
    votesNote:
      'Every topic here opened out of a real residents’ discussion. Voting is location- and identity-verified, and the result is counted in public.',
    tabLive: 'Live votes',
    tabTopics: 'Open topics',
    tabClosed: 'Decided',
    statusLive: 'Live',
    statusClosed: 'Decided',
    statusFresh: 'No ballots yet',
    decided: (option) => `Decided: ${option}`,
    ballots: (n) => `${n} verified ballots`,
    opened: 'Opened',
    closes: 'Closes',
    closed: 'Closed',
    voteCta: 'Vote',
    voteFirstCta: 'Be the first to vote',
    resultCta: 'Full result',
    emptyKicker: 'EMPTY COLUMN · NIL',
    emptyLiveTitle: 'No ballot counted yet',
    emptyLiveBody: (name) =>
      `No vote in ${name} has taken a ballot yet. The topics waiting for a first voice are under "Open topics".`,
    emptyTopicsTitle: 'The table is clear',
    emptyTopicsBody: (name) =>
      `There is no open topic in ${name} right now. A topic opens when a resident raises it — and that can be you.`,
    emptyClosedTitle: 'Nothing decided yet',
    emptyClosedBody: (name) =>
      `No vote has closed in ${name} yet. When one does, the full result prints here — breakdown included.`,

    stripTitle: 'Other authorities',
    stripNote: 'By overall civic score. Unmeasured authorities sit at the end.',
    stripTopics: (n) => (n === 1 ? '1 open topic' : `${n} open topics`),

    closingTitle: 'What nobody votes on gets decided for you.',
    closingBody: (name) =>
      `Every topic opened in ${name} is counted, sealed and sent to the council with the number of voices behind it. Opening one takes two minutes.`,
  },
};
