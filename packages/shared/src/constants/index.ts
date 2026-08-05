/**
 * Shared Constants
 */

// Payment amounts in ILS
/**
 * What a resident pays to participate in a vote, in ILS. Participation became
 * free in cfa5d25 (2026-07-29); this constant exists so every surface reads one
 * number instead of hardcoding a price that no longer applies.
 */
export const VOTE_PARTICIPATION_COST = 0;
export const CREATE_VOTE_COST = 50;

// Merch store (ILS, settled via Green Invoice)
export const MERCH_CURRENCY = 'ILS' as const;
/** Flat print-on-demand shipping fee in ILS. */
export const MERCH_SHIPPING_FLAT_ILS = 25;
/** Order subtotal (ILS) at/above which shipping is free. */
export const MERCH_FREE_SHIPPING_THRESHOLD_ILS = 250;
/** Max units of a single variant per cart line. */
export const MERCH_MAX_QTY_PER_LINE = 10;

// Token conversion rate (1 ILS = 1 SYNC token)
export const TOKEN_RATE = 1;

/**
 * Founders' WhatsApp group — the single persistent join CTA (קבוצת המייסדים)
 * across the site. Centralized so the invite can be rotated in one place.
 */
export const WHATSAPP_FOUNDERS_LINK =
  'https://chat.whatsapp.com/FITvea9IVsn2Ljie1yCrAc';

// Vote duration limits (in days)
export const MIN_VOTE_DURATION = 3;
export const MAX_VOTE_DURATION = 30;

// Vote options limits
export const MIN_VOTE_OPTIONS = 2;
export const MAX_VOTE_OPTIONS = 5;

// Character limits
export const VOTE_TITLE_MAX_LENGTH = 100;
export const VOTE_DESCRIPTION_MAX_LENGTH = 2000;
export const VOTE_OPTION_LABEL_MAX_LENGTH = 100;
export const VOTE_OPTION_DESCRIPTION_MAX_LENGTH = 500;

// GPS accuracy threshold (in meters)
export const GPS_ACCURACY_THRESHOLD = 100;

// Israeli municipalities (sample list)
// GENERATED from taruu-agents discovery/seeds/municipalities.il.json
// (name_he with NAME_ALIASES applied) — every Israeli local authority the
// discovery fleet covers. Regenerate when the seed changes; do not hand-edit.
export const MUNICIPALITIES = [
  'אבו בסמה',
  'אבו גוש',
  'אבו סנאן',
  'אבן יהודה',
  'אום אל-פחם',
  'אופקים',
  'אור יהודה',
  'אור עקיבא',
  'אורנית',
  'אזור',
  'אילת',
  'אכסאל',
  'אל קסום',
  'אל-בטוף',
  'אלונה',
  'אליכין',
  'אלעד',
  'אלפי מנשה',
  'אלקנה',
  'אעבלין',
  'אפרתה',
  'אריאל',
  'אשדוד',
  'אשכול',
  'אשקלון',
  'באקה אל-גרביה',
  'באר טוביה',
  'באר יעקב',
  'באר שבע',
  'בוסתאן אל-מרג',
  'בועיינה-נוגיידאת',
  'בוקעאתה',
  'ביענה',
  'ביר אל-מכסור',
  'בית אל',
  'בית אריה',
  'בית ג\'ן',
  'בית דגן',
  'בית שאן',
  'בית שמש',
  'ביתר עילית',
  'בני ברק',
  'בני עייש',
  'בני שמעון',
  'בנימינה - גבעת עדה',
  'בסמ"ה',
  'בסמת טבעון',
  'ברנר',
  'בת ים',
  'גבעת זאב',
  'גבעת שמואל',
  'גבעתיים',
  'גדיידה-מכר',
  'גדרה',
  'גדרות',
  'גוליס',
  'גולן',
  'גוש חלב',
  'גוש עציון',
  'גזר',
  'גלגוליה',
  'גן יבנה',
  'גן רוה',
  'גני תקוה',
  'גסר א-זרקא',
  'גת',
  'דאלית אל-כרמל',
  'דבוריה',
  'דימונה',
  'דיר אל-אסד',
  'דיר חנא',
  'דרום השרון',
  'הגלבוע',
  'הגליל העליון',
  'הגליל התחתון',
  'הוד השרון',
  'הערבה התיכונה',
  'הר אדר',
  'הר חברון',
  'הרצליה',
  'זבולון',
  'זכרון יעקב',
  'זמר',
  'זרזיר',
  'חבל אילות',
  'חבל יבנה',
  'חבל מודיעין',
  'חדרה',
  'חולון',
  'חוף אשקלון',
  'חוף הכרמל',
  'חוף השרון',
  'חורה',
  'חורפיש',
  'חיפה',
  'חצור הגלילית',
  'חריש-קציר',
  'טבריה',
  'טובא-זנגריה',
  'טורעאן',
  'טייבה',
  'טירה',
  'טירת כרמל',
  'טמרה',
  'יאנוח-גת',
  'יבנאל',
  'יבנה',
  'יהוד-מונוסון',
  'יואב',
  'יסוד המעלה',
  'יפיע',
  'יקנעם עילית',
  'ירוחם',
  'ירושלים',
  'ירכא',
  'כאבול',
  'כאוכב אבו אל-היגא',
  'כוכב יאיר-צור יגאל',
  'כסייפה',
  'כסרא-סמיע',
  'כעביה-טבאש-חגאגרה',
  'כפר ברא',
  'כפר ורדים',
  'כפר יאסיף',
  'כפר יונה',
  'כפר כמא',
  'כפר כנא',
  'כפר מנדא',
  'כפר סבא',
  'כפר קאסם',
  'כפר קרע',
  'כפר שמריהו',
  'כפר תבור',
  'כרמיאל',
  'לב השרון',
  'להבים',
  'לוד',
  'לכיש',
  'לקיה',
  'מבואות החרמון',
  'מבשרת ציון',
  'מגאר',
  'מגד אל-כרום',
  'מגדל',
  'מגדל העמק',
  'מגדל שמס',
  'מגדל תפן',
  'מגידו',
  'מגילות ים המלח',
  'מודיעין עלית',
  'מודיעין-מכבים-רעות',
  'מזכרת בתיה',
  'מזרעה',
  'מטה אשר',
  'מטה בנימין',
  'מטה יהודה',
  'מטולה',
  'מיתר',
  'מנשה',
  'מסעדה',
  'מעיליא',
  'מעלה אדומים',
  'מעלה אפרים',
  'מעלה יוסף',
  'מעלה עירון',
  'מעלות-תרשיחא',
  'מצפה רמון',
  'מרום הגליל',
  'מרחבים',
  'משגב',
  'משהד',
  'נהריה',
  'נווה מדבר',
  'נוף הגליל (נצרת עילית לשעבר)',
  'נחל שורק',
  'נחף',
  'נס ציונה',
  'נצרת',
  'נשר',
  'נתיבות',
  'נתניה',
  'סאגור',
  'סביון',
  'סחנין',
  'עגר',
  'עומר',
  'עילבון',
  'עילוט',
  'עין מאהל',
  'עין קיניה',
  'עכו',
  'עמנואל',
  'עמק הירדן',
  'עמק המעיינות',
  'עמק חפר',
  'עמק יזרעאל',
  'עמק לוד',
  'עספיא',
  'עפולה',
  'עראבה',
  'ערבות הירדן',
  'ערד',
  'ערערה',
  'ערערה בנגב',
  'פוריידיס',
  'פסוטה',
  'פקיעין (בוקייעה)',
  'פרדס חנה-כרכור',
  'פרדסיה',
  'פתח תקווה',
  'צור הדסה',
  'צורן-קדימה',
  'צפת',
  'קדומים',
  'קלנסווה',
  'קצרין',
  'קריית טבעון',
  'קרית אונו',
  'קרית ארבע',
  'קרית אתא',
  'קרית ביאליק',
  'קרית גת',
  'קרית ים',
  'קרית יערים',
  'קרית מוצקין',
  'קרית מלאכי',
  'קרית עקרון',
  'קרית שמונה',
  'קרני שומרון',
  'ראמה',
  'ראש העין',
  'ראש פינה',
  'ראשון לציון',
  'רהט',
  'רחובות',
  'ריינה',
  'רכסים',
  'רמלה',
  'רמת גן',
  'רמת השרון',
  'רמת חובב',
  'רמת ישי',
  'רמת נגב',
  'רעננה',
  'שבלי-אום אל גנם',
  'שגב שלום',
  'שדות נגב',
  'שדרות',
  'שהם',
  'שומרון',
  'שלומי',
  'שעב',
  'שער הנגב',
  'שפיר',
  'שפרעם',
  'תל אביב-יפו',
  'תל מונד',
  'תל שבע',
  'תמר',
] as const;

export * from './geo';

export type Municipality = (typeof MUNICIPALITIES)[number];

/**
 * National scope pseudo-municipality — votes carrying this municipality_id
 * are Knesset-agenda topics (majority decision at the national desk), not
 * local ones. Kept out of MUNICIPALITIES so municipal pickers never list it.
 */
export const KNESSET_SCOPE = 'כנסת ישראל';

// API endpoints
export const API_ENDPOINTS = {
  votes: '/api/votes',
  user: '/api/user',
  payments: '/api/payments',
  auth: '/api/auth',
  verification: '/api/verification',
  social: '/api/social',
} as const;

// Re-export error messages
export * from './errors';
