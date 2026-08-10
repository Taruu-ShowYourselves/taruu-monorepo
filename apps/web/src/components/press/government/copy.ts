/**
 * Every word the two government surfaces print.
 *
 * The `roster` and `reviews` blocks are plain strings on purpose: they cross
 * the server/client boundary as props, and a function in a prop payload is a
 * serialization error rather than a translation.
 */

import type { Locale } from '@/lib/i18n';
import type { GovOffice } from '@sync/shared/contracts';

export interface GovernmentCopy {
  dateLocale: string;

  // ---- Institution page ----
  metaTitle: string;
  metaDescription: string;
  crumbHome: string;
  crumbGovernment: string;
  kicker: string;
  houseName: string;
  term: (n: number) => string;
  termUnknown: string;
  standfirst: string;
  deskCta: string;
  membersCta: string;

  plateLabel: string;
  plateEvidence: (matched: number) => string;
  plateUnmeasured: string;
  scaleMin: string;
  scaleMax: string;

  railMembers: string;
  railMembersNote: string;
  railFactions: string;
  railFactionsNote: string;
  railOpen: string;
  railOpenNote: string;
  railDecided: string;
  railDecidedNote: string;
  railBallots: string;
  railBallotsNote: string;
  railCitizens: string;
  railCitizensNote: (active: string) => string;

  indexTitle: string;
  indexNote: string;
  scoreRepresentation: string;
  scoreEngagement: string;
  scoreAgreement: string;
  scoreTrust: string;
  methodRepresentation: string;
  methodEngagement: string;
  methodAgreement: string;
  methodTrust: string;
  evidenceMatched: (agreed: number, matched: number) => string;
  unmeasured: string;

  matchedTitle: string;
  matchedNote: string;
  publicLabel: string;
  houseLabel: string;
  forLabel: string;
  againstLabel: string;
  abstainLabel: string;
  verdictAgreed: string;
  verdictSplit: string;
  verdictNone: string;
  matchedEmptyTitle: string;
  matchedEmptyBody: string;

  rosterTitle: string;
  rosterNote: string;
  rosterEmptyTitle: string;
  rosterEmptyBody: string;

  cabinetTitle: string;
  cabinetNote: string;

  closingTitle: string;
  closingBody: string;

  // ---- Member page ----
  memberMetaTitle: (name: string) => string;
  memberMetaDescription: (name: string) => string;
  memberNotFound: string;
  memberKicker: string;
  memberStandfirst: (name: string) => string;
  sourceLine: (source: string, asOf: string) => string;
  backToRoster: string;

  memberScoreAlignment: string;
  memberScoreParticipation: string;
  memberScoreTrust: string;
  memberMethodAlignment: string;
  memberMethodParticipation: string;
  memberMethodTrust: string;
  memberEvidenceAlignment: (matched: number) => string;
  memberEvidenceParticipation: (recorded: number, total: number) => string;
  memberEvidenceTrust: (count: number) => string;

  railMatched: string;
  railMatchedNote: string;
  railRecorded: string;
  railRecordedNote: string;
  railRating: string;
  railRatingNote: (count: number) => string;
  railTerm: string;
  railTermNote: string;

  memberVotesTitle: string;
  memberVotesNote: string;
  memberVotesEmptyTitle: string;
  memberVotesEmptyBody: string;
  stanceFor: string;
  stanceAgainst: string;
  stanceAbstain: string;
  stanceAbsent: string;
  stanceUnknown: string;
  memberVerdictWith: string;
  memberVerdictAgainst: string;

  officeNames: Record<GovOffice, string>;

  /** Plain-string blocks handed to client components. */
  roster: RosterCopy;
  reviews: ReviewsCopy;
}

export interface RosterCopy {
  /** Which axes a member's overall score actually rests on. */
  basisPrefix: string;
  basisAlignment: string;
  basisParticipation: string;
  basisTrust: string;
  basisNone: string;
  searchPlaceholder: string;
  allFactions: string;
  sortByScore: string;
  sortByName: string;
  showing: string;
  of: string;
  unmeasured: string;
  noResults: string;
}

export interface ReviewsCopy {
  title: string;
  note: string;
  formTitle: string;
  formEdit: string;
  ratingLabel: string;
  bodyPlaceholder: string;
  submit: string;
  update: string;
  retract: string;
  signedOut: string;
  signIn: string;
  needsRating: string;
  bodyTooShort: string;
  failed: string;
  saved: string;
  mine: string;
  empty: string;
  countOne: string;
  countMany: string;
  average: string;
}

export const GOV_COPY: Record<Locale, GovernmentCopy> = {
  he: {
    dateLocale: 'he-IL',

    metaTitle: 'הכנסת · פרופיל ממשל | תַּרְאוּ',
    metaDescription:
      'מי יושב בכנסת, מה כל אחד מהם מחזיק, איך הצביעו בפועל מול מה שהציבור ביקש, ומה האזרחים חושבים עליהם. הכל ממקור רשמי.',
    crumbHome: 'תַּרְאוּ',
    crumbGovernment: 'ממשל',
    kicker: 'פרופיל ממשל · GOVERNMENT',
    houseName: 'כנסת ישראל',
    term: (n) => `הכנסת ה־${n}`,
    termUnknown: 'המצבת טרם סונכרנה',
    standfirst:
      'מאה ועשרים אנשים מחליטים בשמכם. כאן כתוב מי הם, מה הם מחזיקים, ואיך ההצבעה שלהם במליאה עמדה מול מה שהציבור ביקש באותו נושא בדיוק.',
    deskCta: 'לדסק הכנסת',
    membersCta: 'למצבת החברים',

    plateLabel: 'ציון אזרחי כולל',
    plateEvidence: (matched) =>
      `נמדד על ${matched} נושאים שבהם הצביעו גם הציבור וגם המליאה`,
    plateUnmeasured:
      'טרם נמדד. הציון נפתח כשנושא שפורסם כאן מגיע להצבעה במליאה.',
    scaleMin: '100−',
    scaleMax: '100+',

    railMembers: 'חברי כנסת',
    railMembersNote: 'מצבת החברים המכהנים כרגע',
    railFactions: 'סיעות',
    railFactionsNote: 'סיעות שיש להן נציג מכהן',
    railOpen: 'נושאים פתוחים',
    railOpenNote: 'הצבעות לאומיות שאפשר להשפיע עליהן עכשיו',
    railDecided: 'הוכרעו',
    railDecidedNote: 'הצבעות לאומיות שנסגרו',
    railBallots: 'קולות שנספרו',
    railBallotsNote: 'סך הקולות בכל ההצבעות הלאומיות',
    railCitizens: 'אזרחים רשומים',
    railCitizensNote: (active) => `${active} מהם כבר הצביעו בנושא לאומי`,

    indexTitle: 'המדד האזרחי',
    indexNote:
      'אותו סולם של עמוד הרשות, 100− עד 100+, כדי שאפשר יהיה להחזיק עיר וכנסת זו לצד זו. הציון הכולל נשען על שני הצירים שמודדים את הבית — ייצוג ואמון. מעורבות והסכמה מודדות אותנו, הציבור, ומודפסות כהקשר בלבד. ציר שטרם נמדד מודפס כמקף — אף פעם לא כאפס.',
    scoreRepresentation: 'ייצוג',
    scoreEngagement: 'מעורבות',
    scoreAgreement: 'הסכמה',
    scoreTrust: 'אמון',
    methodRepresentation:
      'מתוך הנושאים שבהם גם הציבור כאן וגם המליאה הכריעו — באיזה שיעור ההכרעות נפגשו.',
    methodEngagement:
      'שיעור האזרחים הרשומים שכבר הצביעו על שאלה לאומית לפחות פעם אחת.',
    methodAgreement:
      'לכל נושא לאומי, פער בעד־נגד חלקי סך הקולות. ציבור שמסכים עם עצמו עולה, ציבור חצוי יורד.',
    methodTrust: 'ממוצע הדירוגים שאזרחים מאומתים נותנים לחברי הכנסת.',
    evidenceMatched: (agreed, matched) =>
      `${agreed} מתוך ${matched} נושאים תואמים`,
    unmeasured: 'טרם נמדד',

    matchedTitle: 'הבית מול הציבור',
    matchedNote:
      'כל שורה היא אותו פריט מסדר היום, פעמיים: איך הצביע כאן הציבור ואיך הצביעה המליאה. פריט שהוצבע יותר מפעם אחת נמדד לפי ההצבעה האחרונה — זו שהכריעה.',
    publicLabel: 'הציבור',
    houseLabel: 'המליאה',
    forLabel: 'בעד',
    againstLabel: 'נגד',
    abstainLabel: 'נמנע',
    verdictAgreed: 'נפגשו',
    verdictSplit: 'פער',
    verdictNone: 'ללא הכרעה',
    matchedEmptyTitle: 'עוד לא נפגשו שתי ההצבעות',
    matchedEmptyBody:
      'אף נושא שפורסם כאן לא הגיע עדיין להצבעה שמית במליאה. ברגע שיגיע, שתי התוצאות יודפסו כאן זו לצד זו.',

    rosterTitle: 'מצבת הכנסת',
    rosterNote:
      'כל מי שהכנסת מפרסמת כמכהן, עם הציון שלו — לרבות שרים שאינם חברי כנסת, שמחזיקים תיק בלי מושב. הרשימה אינה נבחרת בידינו.',
    rosterEmptyTitle: 'המצבת טרם פורסמה',
    rosterEmptyBody:
      'סנכרון המצבת מהמקור הרשמי של הכנסת עוד לא רץ. כשירוץ, כל חבר וחברת כנסת יקבלו עמוד וציון — אוטומטית.',

    cabinetTitle: 'הממשלה',
    cabinetNote: 'מי מחזיק בתיק, לפי הפרסום הרשמי של הכנסת.',

    closingTitle: 'הם מצביעים בשמכם. כאן רואים אם באמת.',
    closingBody:
      'כל נושא שנפתח כאן נספר, נחתם, ומושווה להצבעה השמית של המליאה על אותו פריט עצמו.',

    memberMetaTitle: (name) => `${name} · פרופיל נבחר ציבור | תַּרְאוּ`,
    memberMetaDescription: (name) =>
      `התפקידים של ${name}, ההצבעות שלו מול עמדת הציבור, נוכחות במליאה ודירוג האזרחים. נתונים ממקור רשמי.`,
    memberNotFound: 'נבחר ציבור לא נמצא | תַּרְאוּ',
    memberKicker: 'נבחר ציבור · MEMBER',
    memberStandfirst: (name) =>
      `איך ${name} הצביע בפועל, מול מה שהציבור ביקש באותם נושאים. כל תפקיד וכל הצבעה כאן מגיעים מהפרסום הרשמי של הכנסת.`,
    sourceLine: (source, asOf) => `מקור: ${source} · נכון ל־${asOf}`,
    backToRoster: 'לכל המצבת',

    memberScoreAlignment: 'ייצוג',
    memberScoreParticipation: 'נוכחות',
    memberScoreTrust: 'אמון',
    memberMethodAlignment:
      'מתוך הנושאים שבהם הציבור כאן הכריע והוא הצביע — באיזה שיעור הוא הצביע כמו הציבור.',
    memberMethodParticipation:
      'שיעור ההצבעות השמיות בכהונה שבהן נרשמה לו עמדה. הנתון נמדד מול ההצבעות שכבר מסונכרנות אצלנו.',
    memberMethodTrust: 'ממוצע הדירוגים שאזרחים מאומתים נתנו לו כאן.',
    memberEvidenceAlignment: (matched) => `נמדד על ${matched} הצבעות תואמות`,
    memberEvidenceParticipation: (recorded, total) =>
      `${recorded} מתוך ${total} הצבעות שמיות`,
    memberEvidenceTrust: (count) =>
      count === 1 ? 'דירוג אחד של אזרח' : `${count} דירוגי אזרחים`,

    railMatched: 'הצבעות תואמות',
    railMatchedNote: 'נושאים שבהם הצביעו גם הציבור וגם הוא',
    railRecorded: 'הצבעות שמיות',
    railRecordedNote: 'שבהן נרשמה לו עמדה',
    railRating: 'דירוג אזרחים',
    railRatingNote: (count) =>
      count === 0 ? 'עוד לא דירגו אותו' : `מתוך ${count} דירוגים`,
    railTerm: 'כהונה',
    railTermNote: 'מספר הכנסת שבה הוא מכהן',

    memberVotesTitle: 'הראיות',
    memberVotesNote:
      'ציון בלי הראיות שמאחוריו הוא האשמה. אלה הנושאים שהציון נמדד עליהם, אחד־אחד.',
    memberVotesEmptyTitle: 'אין עדיין ראיות',
    memberVotesEmptyBody:
      'אף נושא שפורסם כאן לא הגיע עדיין להצבעה שמית שבה נרשמה עמדתו.',
    stanceFor: 'הצביע בעד',
    stanceAgainst: 'הצביע נגד',
    stanceAbstain: 'נמנע',
    stanceAbsent: 'לא השתתף',
    stanceUnknown: 'לא נרשמה עמדה',
    memberVerdictWith: 'עם הציבור',
    memberVerdictAgainst: 'נגד הציבור',

    officeNames: {
      pm: 'ראש הממשלה',
      alternate_pm: 'ראש הממשלה החילופי',
      deputy_pm: 'סגן ראש הממשלה',
      minister: 'שר/ה',
      deputy_minister: 'סגן/ית שר',
      speaker: 'יו״ר הכנסת',
      deputy_speaker: 'סגן/ית יו״ר הכנסת',
      opposition_leader: 'ראש/ת האופוזיציה',
      coalition_chair: 'יו״ר הקואליציה',
      faction_chair: 'יו״ר סיעה',
      committee_chair: 'יו״ר ועדה',
      committee_member: 'חבר/ת ועדה',
      mk: 'חבר/ת כנסת',
    },

    roster: {
      basisPrefix: 'נמדד על',
      basisAlignment: 'ייצוג',
      basisParticipation: 'נוכחות',
      basisTrust: 'אמון',
      basisNone: 'טרם נמדד',
      searchPlaceholder: 'חיפוש שם, סיעה או תפקיד…',
      allFactions: 'כל הסיעות',
      sortByScore: 'לפי ציון',
      sortByName: 'לפי שם',
      showing: 'מוצגים',
      of: 'מתוך',
      unmeasured: 'טרם נמדד',
      noResults: 'אין חבר כנסת שמתאים לחיפוש הזה.',
    },

    reviews: {
      title: 'מה האזרחים אומרים',
      note: 'דירוג אחד לכל אזרח מאומת, וניתן לעדכן אותו בכל רגע. הדירוגים מוצגים בלי שם.',
      formTitle: 'דרגו את נבחר הציבור',
      formEdit: 'עדכנו את הדירוג שלכם',
      ratingLabel: 'דירוג 1–5',
      bodyPlaceholder: 'מה עומד מאחורי הדירוג? (לא חובה)',
      submit: 'שליחת דירוג',
      update: 'עדכון הדירוג',
      retract: 'משיכת הדירוג',
      signedOut: 'רק אזרח מאומת יכול לדרג נבחר ציבור.',
      signIn: 'התחברות',
      needsRating: 'בחרו דירוג בין 1 ל־5.',
      bodyTooShort: 'נימוק צריך להיות באורך 10 תווים לפחות, או להישאר ריק.',
      failed: 'הדירוג לא נשמר. נסו שוב.',
      saved: 'הדירוג נשמר.',
      mine: 'הדירוג שלכם',
      empty: 'עוד אף אזרח לא דירג את נבחר הציבור הזה.',
      countOne: 'דירוג אחד',
      countMany: 'דירוגים',
      average: 'ממוצע',
    },
  },

  en: {
    dateLocale: 'en-GB',

    metaTitle: 'The Knesset · government profile | Taruu',
    metaDescription:
      'Who sits in the Knesset, what each of them holds, how they actually voted against what the public asked for, and what citizens make of them. All from official sources.',
    crumbHome: 'Taruu',
    crumbGovernment: 'Government',
    kicker: 'GOVERNMENT PROFILE',
    houseName: 'The Knesset',
    term: (n) => `${n}th Knesset`,
    termUnknown: 'Roster not synced yet',
    standfirst:
      'A hundred and twenty people decide on your behalf. This is who they are, what they hold, and how their vote in the chamber stood against what the public asked for on the very same item.',
    deskCta: 'To the Knesset desk',
    membersCta: 'To the roster',

    plateLabel: 'Overall civic score',
    plateEvidence: (matched) =>
      `Measured over ${matched} items both the public and the chamber voted on`,
    plateUnmeasured:
      'Not measured yet. The score opens when an item published here reaches a recorded vote.',
    scaleMin: '−100',
    scaleMax: '+100',

    railMembers: 'Members',
    railMembersNote: 'Sitting right now',
    railFactions: 'Factions',
    railFactionsNote: 'With a sitting member',
    railOpen: 'Open topics',
    railOpenNote: 'National votes you can still move',
    railDecided: 'Decided',
    railDecidedNote: 'National votes that have closed',
    railBallots: 'Ballots counted',
    railBallotsNote: 'Across every national vote',
    railCitizens: 'Registered citizens',
    railCitizensNote: (active) => `${active} have voted on a national question`,

    indexTitle: 'The civic index',
    indexNote:
      'The same scale as an authority page, −100 to +100, so a city and the Knesset can be held side by side. The overall score rests on the two axes that measure the chamber — representation and trust. Engagement and agreement measure us, the public, and are printed as context only. An axis that has not been measured prints as a dash — never as a zero.',
    scoreRepresentation: 'Representation',
    scoreEngagement: 'Engagement',
    scoreAgreement: 'Agreement',
    scoreTrust: 'Trust',
    methodRepresentation:
      'Of the items where both the public here and the chamber reached a decision, how often the two met.',
    methodEngagement:
      'The share of registered citizens who have voted on a national question at least once.',
    methodAgreement:
      'Per national topic, the for/against gap over the total. A public that agrees with itself rises; a split one falls.',
    methodTrust: 'The average rating verified citizens give Knesset members.',
    evidenceMatched: (agreed, matched) => `${agreed} of ${matched} items matched`,
    unmeasured: 'Not measured yet',

    matchedTitle: 'The chamber against the public',
    matchedNote:
      'Each row is the same agenda item twice: how the public voted here, and how the chamber voted there. An item voted more than once is measured on the last vote — the one that decided it.',
    publicLabel: 'The public',
    houseLabel: 'The chamber',
    forLabel: 'For',
    againstLabel: 'Against',
    abstainLabel: 'Abstain',
    verdictAgreed: 'Met',
    verdictSplit: 'Gap',
    verdictNone: 'No decision',
    matchedEmptyTitle: 'The two votes have not met yet',
    matchedEmptyBody:
      'No topic published here has reached a recorded vote in the chamber yet. When one does, both results print here side by side.',

    rosterTitle: 'The roster',
    rosterNote:
      'Everyone the Knesset publishes as holding office, each with their score — including ministers who are not members, who hold a portfolio without a seat. The list is not curated by us.',
    rosterEmptyTitle: 'The roster has not been published yet',
    rosterEmptyBody:
      'The sync from the Knesset’s official source has not run yet. When it does, every member gets a page and a score — automatically.',

    cabinetTitle: 'The cabinet',
    cabinetNote: 'Who holds which portfolio, per the Knesset’s own publication.',

    closingTitle: 'They vote on your behalf. Here you can see whether they did.',
    closingBody:
      'Every topic opened here is counted, sealed, and compared against the chamber’s recorded vote on that very item.',

    memberMetaTitle: (name) => `${name} · member profile | Taruu`,
    memberMetaDescription: (name) =>
      `${name}'s offices, their votes against the public's position, chamber attendance and citizen rating. From official sources.`,
    memberNotFound: 'Member not found | Taruu',
    memberKicker: 'ELECTED MEMBER',
    memberStandfirst: (name) =>
      `How ${name} actually voted, against what the public asked for on the same items. Every office and every vote here comes from the Knesset's own publication.`,
    sourceLine: (source, asOf) => `Source: ${source} · as of ${asOf}`,
    backToRoster: 'Back to the roster',

    memberScoreAlignment: 'Representation',
    memberScoreParticipation: 'Attendance',
    memberScoreTrust: 'Trust',
    memberMethodAlignment:
      'Of the items where the public here decided and they voted, how often they voted the public’s way.',
    memberMethodParticipation:
      'The share of this term’s recorded votes in which they took a side. Measured against the votes already mirrored here.',
    memberMethodTrust: 'The average rating verified citizens have given them.',
    memberEvidenceAlignment: (matched) => `Measured over ${matched} matched votes`,
    memberEvidenceParticipation: (recorded, total) =>
      `${recorded} of ${total} recorded votes`,
    memberEvidenceTrust: (count) =>
      count === 1 ? '1 citizen rating' : `${count} citizen ratings`,

    railMatched: 'Matched votes',
    railMatchedNote: 'Items both the public and they voted on',
    railRecorded: 'Recorded votes',
    railRecordedNote: 'In which they took a side',
    railRating: 'Citizen rating',
    railRatingNote: (count) =>
      count === 0 ? 'No ratings yet' : `Across ${count} ratings`,
    railTerm: 'Term',
    railTermNote: 'The Knesset they sit in',

    memberVotesTitle: 'The evidence',
    memberVotesNote:
      'A score without its evidence is an accusation. These are the items it was measured on, one by one.',
    memberVotesEmptyTitle: 'No evidence yet',
    memberVotesEmptyBody:
      'No topic published here has reached a recorded vote where their position was registered.',
    stanceFor: 'Voted for',
    stanceAgainst: 'Voted against',
    stanceAbstain: 'Abstained',
    stanceAbsent: 'Did not take part',
    stanceUnknown: 'No position recorded',
    memberVerdictWith: 'With the public',
    memberVerdictAgainst: 'Against the public',

    officeNames: {
      pm: 'Prime Minister',
      alternate_pm: 'Alternate Prime Minister',
      deputy_pm: 'Deputy Prime Minister',
      minister: 'Minister',
      deputy_minister: 'Deputy Minister',
      speaker: 'Speaker of the Knesset',
      deputy_speaker: 'Deputy Speaker',
      opposition_leader: 'Leader of the Opposition',
      coalition_chair: 'Coalition Chair',
      faction_chair: 'Faction Chair',
      committee_chair: 'Committee Chair',
      committee_member: 'Committee Member',
      mk: 'Member of Knesset',
    },

    roster: {
      basisPrefix: 'Measured on',
      basisAlignment: 'representation',
      basisParticipation: 'attendance',
      basisTrust: 'trust',
      basisNone: 'Not measured yet',
      searchPlaceholder: 'Search name, faction or office…',
      allFactions: 'All factions',
      sortByScore: 'By score',
      sortByName: 'By name',
      showing: 'Showing',
      of: 'of',
      unmeasured: 'Not measured',
      noResults: 'No member matches that search.',
    },

    reviews: {
      title: 'What citizens say',
      note: 'One rating per verified citizen, amendable at any time. Ratings are shown without a name.',
      formTitle: 'Rate this member',
      formEdit: 'Update your rating',
      ratingLabel: 'Rating 1-5',
      bodyPlaceholder: 'What is behind the rating? (optional)',
      submit: 'Submit rating',
      update: 'Update rating',
      retract: 'Withdraw rating',
      signedOut: 'Only a verified citizen can rate an elected member.',
      signIn: 'Sign in',
      needsRating: 'Pick a rating between 1 and 5.',
      bodyTooShort: 'A note must be at least 10 characters, or left empty.',
      failed: 'The rating was not saved. Try again.',
      saved: 'Rating saved.',
      mine: 'Your rating',
      empty: 'No citizen has rated this member yet.',
      countOne: '1 rating',
      countMany: 'ratings',
      average: 'average',
    },
  },
};
