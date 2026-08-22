// LOCAL PROTOTYPE ONLY - seeds Knesset-scope topics into a LOCAL Supabase
// stack so the national lane of the entry prototype has something to show.
//
// Companion to seed-consensus-desk.mjs, which seeds the municipal desk. The
// real national desk is filled by the Knesset OData sync and ranked by
// agents/knesset-ranker; this script exists only so a reviewer running the
// branch locally sees the lane populated instead of its empty state. Every
// row is stamped `model: 'local-prototype-seed'` so it can never be mistaken
// for ranker output, and no vote_sources rows are written - fabricated
// engagement never ships (same rule as seed-consensus-desk.mjs).
//
// Refuses to run against anything but 127.0.0.1/localhost.
//
// Delete everything both seeds created with:
//   DELETE FROM votes WHERE creator_id = '99999999-9999-4999-8999-999999999999';
const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !KEY) throw new Error('missing supabase env');
if (!/127\.0\.0\.1|localhost/.test(URL_BASE)) throw new Error('refusing: not a local stack');

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function upsert(table, rows, onConflict) {
  const res = await fetch(`${URL_BASE}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
  console.log(`${table}: upserted ${rows.length}`);
}

const DESK_USER = '99999999-9999-4999-8999-999999999999';
const KNESSET = 'כנסת ישראל';
const days = (n) => new Date(Date.now() + n * 86_400_000).toISOString();

// Legal-citation shaped titles, so formatBillTitle() has something real to split.
const ITEMS = [
  {
    s: 'a1',
    title: 'הצעת חוק התחבורה הציבורית (תיקון מס\' 7) (נגישות ותדירות בפריפריה), התשפ"ו-2026',
    description: 'התיקון מחייב תקן תדירות מזערי לקווי אוטובוס ביישובי פריפריה ומעגן מנגנון פיצוי לנוסעים על ביטולי קווים.',
    headline: 'תקן תדירות מחייב לאוטובוסים בפריפריה',
    summary: 'ההצעה קובעת תדירות מזערית לקווים ביישובים מרוחקים, ומחייבת דיווח ציבורי חודשי על קווים שבוטלו.',
    hotness: 88, relevance: 92, media: 82, days: 11,
    options: [['בעד', 0], ['נגד', 0], ['נמנע', 0]],
  },
  {
    s: 'a2',
    title: 'הצעת חוק התכנון והבנייה (תיקון מס\' 149) (קיצור הליכי היתר לדיור בר-השגה), התשפ"ו-2026',
    description: 'קיצור לוחות הזמנים בוועדות המקומיות לתוכניות שמייעדות לפחות רבע מהיחידות לדיור בר-השגה.',
    headline: 'מסלול מהיר בוועדות לתוכניות דיור בר-השגה',
    summary: 'ההצעה מקצרת את משך הדיון בוועדה המקומית ומטילה מועד קבוע להכרעה בתוכניות עם מרכיב דיור בר-השגה.',
    hotness: 81, relevance: 84, media: 76, days: 15,
    options: [['בעד', 0], ['נגד', 0], ['נמנע', 0]],
  },
  {
    s: 'a3',
    title: 'הצעת חוק חופש המידע (תיקון מס\' 15) (פרסום יזום של חוזי רשויות מקומיות), התשפ"ו-2026',
    description: 'חיוב רשויות מקומיות לפרסם ביוזמתן חוזי התקשרות מעל סכום סף, במאגר פתוח וניתן לחיפוש.',
    headline: 'חוזי רשויות מקומיות - פרסום יזום במאגר פתוח',
    summary: 'ההצעה מחייבת פרסום יזום של חוזים מעל סכום סף, כולל נספחים כספיים, תוך 30 יום מחתימה.',
    hotness: 74, relevance: 78, media: 68, days: 9,
    options: [['בעד', 0], ['נגד', 0], ['נמנע', 0]],
  },
  {
    s: 'a4',
    title: 'הצעת חוק הפיקוח על מזון (תיקון) (סימון מחיר ליחידת מידה ברשתות מזון), התשפ"ו-2026',
    description: 'חיוב רשתות המזון לסמן מחיר ליחידת מידה אחידה בכל מדף פיזי ובכל ממשק מקוון.',
    headline: 'סימון מחיר ליחידת מידה בכל מדף ובכל אתר',
    summary: 'ההצעה מחייבת סימון אחיד של מחיר ליחידת מידה ומטילה קנס מנהלי על אי-סימון חוזר.',
    hotness: 69, relevance: 71, media: 66, days: 18,
    options: [['בעד', 0], ['נגד', 0], ['נמנע', 0]],
  },
  {
    s: 'a5',
    title: 'הצעת חוק החינוך המיוחד (תיקון מס\' 24) (סייעות רפואיות בגני ילדים), התשפ"ו-2026',
    description: 'הרחבת הזכאות לסייעת רפואית בגני ילדים והעברת מימונה למשרד החינוך במקום לרשות המקומית.',
    headline: 'מימון סייעות רפואיות עובר למשרד החינוך',
    summary: 'ההצעה מעבירה את מימון הסייעות הרפואיות בגנים מהרשות המקומית למדינה, ומרחיבה את עילות הזכאות.',
    hotness: 66, relevance: 73, media: 55, days: 21,
    options: [['בעד', 0], ['נגד', 0], ['נמנע', 0]],
  },
  {
    s: 'a6',
    title: 'הצעת חוק איכות הסביבה (מניעת מפגעי רעש מכלי טיס בלתי מאוישים), התשפ"ו-2026',
    description: 'הסדרת שעות ההפעלה ומסלולי הטיסה של רחפנים מסחריים מעל אזורי מגורים.',
    headline: 'הגבלת שעות ומסלולים לרחפני משלוחים מעל שכונות',
    summary: 'ההצעה אוסרת טיסת רחפנים מסחריים מעל אזורי מגורים בשעות הלילה וקובעת מנגנון תלונות מקומי.',
    hotness: 58, relevance: 60, media: 54, days: 13,
    options: [['בעד', 0], ['נגד', 0], ['נמנע', 0]],
  },
];

const votes = ITEMS.map((it) => ({
  id: `00000000-0000-4000-8000-00000000${it.s}00`,
  creator_id: DESK_USER,
  title: it.title,
  description: it.description,
  municipality_id: KNESSET,
  status: 'active',
  start_date: new Date().toISOString(),
  end_date: days(it.days),
  participant_count: 0,
}));

const options = ITEMS.flatMap((it, vi) =>
  it.options.map(([text, v], i) => ({
    id: `00000000-0000-4000-9000-0000000${vi}${it.s}${i}0`.slice(0, 36),
    vote_id: `00000000-0000-4000-8000-00000000${it.s}00`,
    text,
    votes: v,
  }))
);

const rankings = ITEMS.map((it) => ({
  vote_id: `00000000-0000-4000-8000-00000000${it.s}00`,
  hotness: it.hotness,
  relevance: it.relevance,
  media: it.media,
  headline: it.headline,
  // The rationale slot is what the tile prints under the headline, so it
  // carries the item's own plain-language summary. The row is still marked as
  // a local seed in `model`.
  rationale: it.summary,
  media_refs: [],
  media_evidence: {},
  model: 'local-prototype-seed',
}));

const items = ITEMS.map((it, i) => ({
  vote_id: `00000000-0000-4000-8000-00000000${it.s}00`,
  item_id: 900000 + i,
  plenum_session_id: 990001,
  session_date: days(2),
  session_number: 41,
  knesset_num: 26,
  item_type: 'הצעת חוק',
  ordinal: i + 1,
  status_id: 1,
  is_discussion: false,
  summary: it.summary,
  summary_model: 'local-prototype-seed',
  summarized_at: new Date().toISOString(),
}));

await upsert('votes', votes, 'id');
await upsert('vote_options', options, 'id');
await upsert('knesset_rankings', rankings, 'vote_id');
await upsert('knesset_items', items, 'vote_id');
console.log('knesset seed done');
