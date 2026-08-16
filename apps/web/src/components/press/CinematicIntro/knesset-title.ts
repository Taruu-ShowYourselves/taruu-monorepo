import type { Locale } from '@/lib/i18n';

export interface StructuredKnessetTitle {
  kind: string;
  headline: string;
  tags: string[];
}

interface KnessetTitleCopy {
  agendaKind: string;
  fastTrackKind: string;
  billKind: string;
  lawKind: string;
  recommendationKind: string;
  amendmentTag: string;
  temporaryProvisionTag: string;
  legislativeAmendmentsTag: string;
}

const COPY: Record<Locale, KnessetTitleCopy> = {
  he: {
    agendaKind: 'סדר היום',
    fastTrackKind: 'דיון מהיר',
    billKind: 'הצעת חוק',
    lawKind: 'חקיקה',
    recommendationKind: 'המלצת מליאה',
    amendmentTag: 'תיקון',
    temporaryProvisionTag: 'הוראת שעה',
    legislativeAmendmentsTag: 'תיקוני חקיקה',
  },
  en: {
    agendaKind: 'Agenda',
    fastTrackKind: 'Urgent debate',
    billKind: 'Bill',
    lawKind: 'Legislation',
    recommendationKind: 'Plenum recommendation',
    amendmentTag: 'Amendment',
    temporaryProvisionTag: 'Temporary provision',
    legislativeAmendmentsTag: 'Legislative amendments',
  },
};

const MAX_HEADLINE = 52;
const MAX_TAG = 30;

function compact(value: string): string {
  return value
    .replace(/[\u2013\u2014]/g, ',')
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,{2,}/g, ',')
    .trim()
    .replace(/[.,:]+$/g, '');
}

function shorten(value: string, limit: number): string {
  if (value.length <= limit) return value;
  const slice = value.slice(0, limit - 1);
  const boundary = slice.lastIndexOf(' ');
  return `${slice.slice(0, boundary > limit * 0.62 ? boundary : undefined).trim()}…`;
}

function tagsForParenthetical(value: string, t: KnessetTitleCopy): string[] {
  const content = compact(value);
  const tags: string[] = [];
  const amendment = content.match(
    /(?:^|\s)תיקון\s+(?:מס[׳'"]\s*)?(\d+)/u
  );
  const numbered = content.match(/^מס[׳'"]\s*(\d+)/u);

  if (amendment?.[1] || numbered?.[1]) {
    tags.push(`${t.amendmentTag} ${amendment?.[1] ?? numbered?.[1]}`);
  }
  if (/הוראת שעה/u.test(content)) tags.push(t.temporaryProvisionTag);
  if (/תיקוני חקיקה/u.test(content)) tags.push(t.legislativeAmendmentsTag);

  if (tags.length > 0) return tags;

  const subject = content.replace(/^תיקון\s*[-,:]\s*/u, '');
  return subject ? [shorten(subject, MAX_TAG)] : [];
}

/**
 * Remove the procedural language used by official feeds while keeping the
 * public subject intact. These transformations are deliberately lexical so
 * every refresh produces the same headline without inventing information.
 */
function editorialHeadline(value: string): string {
  return compact(value)
    .replace(
      /^הצהרת אמונים של חבר(?:ת)? הכנסת\s+/u,
      'הצהרת אמונים: ח״כ '
    )
    .replace(/בצבא הגנה לישראל/gu, 'בצה״ל')
    .replace(/^נוכחות עורך דין\s+/u, 'עורך דין ')
    .replace(/^לתיקון פקודת\s+/u, 'פקודת ')
    .replace(/^לעידוד פעילות\s+/u, 'עידוד פעילות ')
    .replace(/^הצורך ב/u, '')
    .replace(/\s+-\s+/g, ': ');
}

/**
 * Turn an official Knesset agenda title into an editorial display title.
 * The original string remains the canonical value and should be kept in the
 * link title/aria label; this function only controls visual hierarchy.
 */
export function structureKnessetTitle(
  officialTitle: string,
  officialType?: string | null,
  locale: Locale = 'he'
): StructuredKnessetTitle {
  const t = COPY[locale];
  let title = compact(officialTitle);
  let kind = officialType || t.agendaKind;
  const tags: string[] = [];
  const years: string[] = [];

  const prefixes: Array<[RegExp, string]> = [
    [/^הצעה\s+רגילה\s+לסדר\s+היום\s+בנושא:\s*/u, t.agendaKind],
    [/^הצעה\s+לדיון\s+מהיר\s+בנושא:\s*/u, t.fastTrackKind],
    [/^הצעת\s+חוק\s+/u, t.billKind],
    [/^חוק\s+/u, t.lawKind],
    [/^המלצה\s+/u, t.recommendationKind],
  ];

  for (const [pattern, label] of prefixes) {
    if (!pattern.test(title)) continue;
    kind = label;
    title = title.replace(pattern, '');
    break;
  }

  title = title.replace(
    /,?\s*התשפ[א-ת״׳'"]*\s*[-\u2013,]\s*(20\d{2})/gu,
    (_match, year: string) => {
      years.push(year);
      return '';
    }
  );

  const proceduralSuffix = title.match(
    /,\s*לפי\s+(סעיף\s+\d+(?:\([^)]*\))?.+)$/u
  );
  if (proceduralSuffix?.[1]) {
    tags.push(shorten(proceduralSuffix[1], MAX_TAG));
    title = title.replace(/,\s*לפי\s+סעיף.+$/u, '');
  }

  title = title.replace(/\(([^()]*)\)/gu, (_match, content: string) => {
    tags.push(...tagsForParenthetical(content, t));
    return '';
  });

  tags.push(...years);

  title = editorialHeadline(title)
    .replace(/^לתיקון\s+/u, 'תיקון ')
    .replace(/^לבחירת\s+/u, 'בחירת ')
    .replace(/^['"״]|['"״]$/g, '');

  return {
    kind,
    headline: shorten(title || officialTitle, MAX_HEADLINE),
    tags: [...new Set(tags)].slice(0, 3),
  };
}
