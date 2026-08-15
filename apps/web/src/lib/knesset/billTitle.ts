/**
 * Knesset agenda titles are legal citations, not headlines.
 *
 * The Knesset OData feed hands us strings like
 * `הצעת חוק הגנת הצרכן (תיקון מס' 74), התשפ"ו-2026`, and the sync truncates
 * long ones mid-string, so a tile can end up printing `(שידורים),... התשפ"ו-2026`
 * This produces two ellipses, an orphaned year, and the actual subject clipped away.
 *
 * This splits a citation into the three things a front page sets separately:
 * the instrument (a kicker), the subject (the headline) and the qualifying
 * clause (a mono tag). Nothing is invented and nothing meaningful is dropped -
 * every part that is removed from the headline is returned in another field,
 * except the year, which is the same for the whole order of the day.
 */

export interface BillTitle {
  /** Instrument type: `הצעת חוק`, `חוק-יסוד`, `דיון מהיר`… Null when unrecognised. */
  kicker: string | null;
  /** The subject, as a headline. Never empty - falls back to the raw title. */
  headline: string;
  /** Amendment number and/or the parenthetical clause, joined with `·`. */
  qualifier: string | null;
}

/** `התשפ"ו-2026`, `התשפ״ו–2026`, `התשפ"ה-2025` - the Hebrew legislative year. */
const HEBREW_YEAR = /[,\s]*הת[א-ת]{1,4}["'״׳]?[א-ת]?\s*[-\u2013\u2014]\s*\d{4}\s*$/;

/** What the sync leaves behind when it cuts a title short. */
const TRUNCATION = /[,\s]*(?:\.{3}|…)\s*$/;

/** A parenthetical the truncation cut open: `(שמחת` with no closing bracket. */
const DANGLING_PAREN = /\s*\([^)]*$/;

/** Leading instrument, longest first so `הצעת חוק` wins over `חוק`. */
const INSTRUMENTS: readonly (readonly [RegExp, string])[] = [
  [/^הצעה\s+לדיון\s+מהיר\s+בנושא\s*:?\s*/, 'דיון מהיר'],
  [/^הצעה\s+לסדר\s+היום\s+בנושא\s*:?\s*/, 'הצעה לסדר היום'],
  [/^שאילתה\s+דחופה\s*:?\s*/, 'שאילתה דחופה'],
  [/^הצעת\s+חוק[-־]יסוד\s*:?\s*/, 'הצעת חוק-יסוד'],
  [/^חוק[-־]יסוד\s*:?\s*/, 'חוק-יסוד'],
  [/^הצעת\s+חוק\s+/, 'הצעת חוק'],
  [/^חוק\s+/, 'חוק'],
];

/** `תיקון מס' 74`, `תיקון מספר 74`, `תיקון 74`. */
const AMENDMENT = /תיקון\s+(?:מס['׳]?|מספר)?\s*(\d+)/;

const squash = (value: string) => value.replace(/\s+/g, ' ').trim();

/** Trim separators the surgery above can leave stranded at either end. */
const trimPunctuation = (value: string) =>
  squash(value)
    .replace(/^[\s,;:.\u2013\u2014-]+/, '')
    .replace(/[\s,;:.\u2013\u2014-]+$/, '');

/**
 * Pull the last balanced `(…)` group off the end of a title.
 *
 * Only a trailing group is a qualifying clause. A parenthetical in the middle
 * (`חוק הביטוח הלאומי (נוסח משולב) לעניין…`) is part of the subject and stays
 * in the headline where it belongs.
 */
function splitTrailingClause(title: string): { head: string; clause: string | null } {
  if (!title.endsWith(')')) return { head: title, clause: null };

  let depth = 0;
  for (let i = title.length - 1; i >= 0; i -= 1) {
    if (title[i] === ')') depth += 1;
    else if (title[i] === '(') {
      depth -= 1;
      if (depth === 0) {
        return {
          head: title.slice(0, i).trim(),
          clause: title.slice(i + 1, -1).trim() || null,
        };
      }
    }
  }
  return { head: title, clause: null };
}

/**
 * Split a Knesset citation into kicker / headline / qualifier.
 *
 * Order matters: the year and the truncation marks come off the end first, so
 * that a clause the sync cut in half is recognised as broken rather than read
 * as the subject.
 */
export function formatBillTitle(raw: string): BillTitle {
  const original = squash(raw);
  if (!original) return { kicker: null, headline: '', qualifier: null };

  let working = original;
  // `(שידורים),... התשפ"ו-2026` sheds the year, then the ellipsis, in that order.
  working = working.replace(HEBREW_YEAR, '');
  working = working.replace(TRUNCATION, '');
  working = working.replace(DANGLING_PAREN, '');
  working = trimPunctuation(working);

  let kicker: string | null = null;
  for (const [pattern, label] of INSTRUMENTS) {
    if (pattern.test(working)) {
      kicker = label;
      working = working.replace(pattern, '');
      break;
    }
  }

  const { head, clause } = splitTrailingClause(trimPunctuation(working));

  const qualifiers: string[] = [];
  let rest = clause;
  if (clause) {
    const amendment = clause.match(AMENDMENT);
    if (amendment) {
      qualifiers.push(`תיקון ${amendment[1]}`);
      // `תיקון מס' 29 - הוראת שעה` keeps the part the number was qualifying.
      rest = trimPunctuation(clause.replace(AMENDMENT, ''));
    }
    if (rest) qualifiers.push(rest);
  }

  const headline = trimPunctuation(head);

  // Stripping must never leave a tile with no headline: a title that is
  // nothing but an instrument and a clause keeps its clause as the subject.
  if (!headline) {
    return {
      kicker,
      headline: qualifiers.length > 0 ? qualifiers.join(' · ') : original,
      qualifier: null,
    };
  }

  return {
    kicker,
    headline,
    qualifier: qualifiers.length > 0 ? qualifiers.join(' · ') : null,
  };
}
