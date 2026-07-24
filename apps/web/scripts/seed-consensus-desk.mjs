// Seed pilot consensus topics into the live Taroo Supabase project.
// Insert-only, idempotent-ish (fixed UUIDs, upsert on conflict).
// Delete everything it created with:
//   DELETE FROM votes WHERE creator_id = '99999999-9999-4999-8999-999999999999';
//   DELETE FROM users WHERE id = '99999999-9999-4999-8999-999999999999';

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !KEY) throw new Error('missing supabase env');

const H = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
};

async function upsert(table, rows, onConflict) {
  const res = await fetch(
    `${URL_BASE}/rest/v1/${table}?on_conflict=${onConflict}`,
    {
      method: 'POST',
      headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows),
    }
  );
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
  console.log(`${table}: upserted ${rows.length}`);
}

const DESK_USER = '99999999-9999-4999-8999-999999999999';

const days = (n) => new Date(Date.now() + n * 86_400_000).toISOString();

// v(id-suffix, city, title, description, endInDays, options[[text, votes]])
const v = (suffix, municipality, title, description, endInDays, options) => ({
  vote: {
    id: `00000000-0000-4000-8000-0000000000${suffix}`,
    creator_id: DESK_USER,
    title,
    description,
    municipality_id: municipality,
    status: 'active',
    start_date: new Date().toISOString(),
    end_date: days(endInDays),
    participant_count: options.reduce((s, [, n]) => s + n, 0),
  },
  options: options.map(([text, votes], i) => ({
    id: `00000000-0000-4000-9000-00000000${suffix}${String(i).padStart(2, '0')}`.slice(0, 36),
    vote_id: `00000000-0000-4000-8000-0000000000${suffix}`,
    text,
    votes,
  })),
});

const SEEDS = [
  v('01', 'תל אביב-יפו', 'שבילי אופניים מוגנים באבן גבירול', 'הפרדה פיזית של שביל האופניים ממדרכת הולכי הרגל לאורך אבן גבירול, מצומת ארלוזורוב ועד כיכר רבין.', 12, [['בעד הפרדה מלאה', 341], ['נגד — להשאיר כמו היום', 97], ['נמנע', 28]]),
  v('02', 'תל אביב-יפו', 'הארכת שעות פעילות גני משחקים מוארים', 'תאורה ופתיחת גני משחקים מרכזיים עד 22:00 בקיץ.', 9, [['בעד', 218], ['נגד', 64], ['נמנע', 19]]),
  v('03', 'תל אביב-יפו', 'סוף שבוע ללא רכב בשוק הכרמל', 'סגירת רחוב הכרמל לתנועת רכב בסופי שבוע והרחבת המדרחוב.', 20, [['בעד', 156], ['נגד', 88]]),
  v('04', 'ירושלים', 'קו לילה תדיר לשכונות הדרום', 'תגבור קווי הלילה לגילה, הר חומה ותלפיות מזרח לתדירות של 20 דקות.', 14, [['בעד תגבור', 264], ['נגד — עדיפות לתקציב אחר', 71], ['נמנע', 33]]),
  v('05', 'ירושלים', 'גינה קהילתית במגרש הריק ברחוב יפו 130', 'הקצאת המגרש העירוני הריק לגינה קהילתית מנוהלת על ידי תושבי לב העיר.', 18, [['בעד גינה קהילתית', 189], ['בעד חניון ציבורי', 102], ['נמנע', 17]]),
  v('06', 'חיפה', 'שיקום מדרגות ואדי ניסנאס והדר', 'שיפוץ ותאורה של גרמי המדרגות ההיסטוריים המחברים את הדר לעיר התחתית.', 16, [['בעד שיקום מלא', 142], ['בעד תאורה בלבד', 58], ['נגד', 21]]),
  v('07', 'חיפה', 'חוף הסטודנטים — אזור מנגלים מוסדר', 'הסדרת אזור מנגלים ייעודי עם עמדות ניקיון בחוף הסטודנטים במקום האיסור הגורף.', 8, [['בעד הסדרה', 96], ['נגד — להשאיר איסור', 74]]),
  v('08', 'ראשון לציון', 'מוקד שיטור עירוני במערב העיר', 'הקמת מוקד שיטור עירוני קבוע ברובע המערבי ליד קניון הזהב.', 11, [['בעד', 128], ['נגד', 42], ['נמנע', 12]]),
  v('09', 'באר שבע', 'הצללות בכל תחנות האוטובוס עד קיץ 2027', 'תוכנית רב־שנתית להצללת כל תחנות האוטובוס בעיר, בעדיפות לשכונות ד׳ ו־ט׳.', 25, [['בעד', 203], ['נגד — עדיפות תקציבית אחרת', 39]]),
];

await upsert('users', [{
  id: DESK_USER,
  email: 'desk@taruu.co.il',
  first_name: 'שולחן',
  last_name: 'המערכת',
  municipality_id: 'תל אביב-יפו',
  identity_score: 0,
  verification_status: 'none',
}], 'id');

await upsert('votes', SEEDS.map((s) => s.vote), 'id');
await upsert('vote_options', SEEDS.flatMap((s) => s.options), 'id');
// NOTE: vote_sources is intentionally NOT seeded — FB engagement must come
// from the taruu-agents discovery pipeline via POST /api/ingest/topics
// (contract: docs/INGEST.md). Fabricated engagement never ships.
console.log('done');
