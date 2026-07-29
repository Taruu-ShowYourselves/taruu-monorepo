/**
 * Knesset document summaries — pulls the official document attached to each
 * day-order item (bill text / agenda-proposal text) from fs.knesset.gov.il,
 * extracts its text and stores a short Hebrew summary on knesset_items, so
 * the vote page can explain what is actually on the table.
 *
 * Work-queue semantics: getKnessetItemsPendingSummary returns items never
 * attempted; every attempt stamps summarized_at (even doc-less ones), so the
 * cron converges instead of re-grinding the same rows. Runs from
 * /api/cron/knesset-docs.
 */

import { unzipSync, strFromU8 } from 'fflate';
import {
  getKnessetItemsPendingSummary,
  updateKnessetItemDocSummary,
} from '@/lib/supabase/db';
import type { KnessetItem } from '@/lib/supabase/types';
import { cronLogger as log } from '@/lib/logger';
import {
  fetchBillDocuments,
  fetchAgendaDocuments,
  type KnsDocument,
} from './odata';

const ITEMS_PER_RUN = 6;
const DOWNLOAD_TIMEOUT_MS = 20_000;
const MAX_DOC_BYTES = 4 * 1024 * 1024;
/** Claude gets at most this much extracted text per document. */
const MAX_EXTRACT_CHARS = 18_000;

const ANTHROPIC_MODEL =
  process.env.KNESSET_SUMMARY_MODEL ?? 'claude-haiku-4-5-20251001';

export interface KnessetDocsSyncResult {
  scanned: number;
  summarized: number;
  docOnly: number;
  docless: number;
  errors: string[];
}

/**
 * Bill documents, best first: the enacted/unofficial final text beats later
 * readings beats the first reading beats background material.
 */
const BILL_GROUP_PRIORITY = new Map<number, number>([
  [8, 0], // חוק - נוסח לא רשמי
  [4, 1], // הצעת חוק לקריאה השנייה והשלישית
  [2, 2], // הצעת חוק לקריאה הראשונה
  [1, 3], // הצעת חוק מקורית
  [59, 4], // חומר רקע
]);

function groupRank(doc: KnsDocument): number {
  return BILL_GROUP_PRIORITY.get(doc.GroupTypeID ?? -1) ?? 9;
}

/** fs.knesset.gov.il paths sometimes arrive with backslashes — normalize. */
export function normalizeDocUrl(path: string): string {
  return path.replace(/\\/g, '/');
}

function isDocx(doc: KnsDocument): boolean {
  return Boolean(doc.FilePath && /\.docx$/i.test(doc.FilePath.trim()));
}

/**
 * Choose the document to summarize: highest-priority group with a .docx
 * (extractable) file; falls back to the best-ranked document of any format
 * so the UI can at least link the original.
 */
export function pickDocument(docs: KnsDocument[]): {
  extractable: KnsDocument | null;
  linkable: KnsDocument | null;
} {
  const withFiles = docs.filter((d) => d.FilePath?.trim());
  if (withFiles.length === 0) return { extractable: null, linkable: null };

  const ranked = [...withFiles].sort((a, b) => groupRank(a) - groupRank(b));
  const extractable = ranked.find(isDocx) ?? null;
  return { extractable, linkable: extractable ?? ranked[0] };
}

/** Look up the attachment table matching the item's day-order type. */
async function fetchItemDocuments(item: KnessetItem): Promise<KnsDocument[]> {
  const type = item.item_type ?? '';
  if (type.includes('חוק')) return fetchBillDocuments(item.item_id);
  if (type.includes('לסדר היום')) return fetchAgendaDocuments(item.item_id);
  // Generic plenum items ('פריטי מליאה' etc.) — try both identities.
  const [bills, agenda] = await Promise.all([
    fetchBillDocuments(item.item_id).catch(() => []),
    fetchAgendaDocuments(item.item_id).catch(() => []),
  ]);
  return [...bills, ...agenda];
}

/** Unzip word/document.xml and strip WordprocessingML down to plain text. */
export function extractDocxText(bytes: Uint8Array): string {
  const files = unzipSync(bytes);
  const xml = files['word/document.xml'];
  if (!xml) return '';
  return strFromU8(xml)
    .replace(/<\/w:p>/g, '\n')
    .replace(/<w:tab[^>]*\/>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

async function downloadDoc(url: string): Promise<Uint8Array | null> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });
  if (!response.ok) return null;
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_DOC_BYTES) return null;
  return new Uint8Array(buffer);
}

/**
 * Neutral civic-press summary in Hebrew via the Anthropic API. Returns null
 * when no API key is configured (the run then only records document links).
 */
async function summarizeDocument(
  title: string,
  docGroup: string,
  text: string
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 400,
      messages: [
        {
          role: 'user',
          content:
            'אתה עורך בדסק פרלמנטרי של עיתון אזרחי. סכם בעברית, בניסוח ניטרלי ' +
            'ובהיר לקורא שאינו משפטן, את המסמך הרשמי הבא מסדר היום של מליאת ' +
            'הכנסת. 2 עד 4 משפטים: מה מוצע לשנות או לקבוע, את מי זה נוגע, ' +
            'ומה ההקשר (הוראת שעה, תיקון, הצעה לדיון וכו׳). בלי דעה, בלי ' +
            'קריאה לפעולה, בלי פתיחים כמו "המסמך עוסק ב...". החזר את הסיכום ' +
            'בלבד.\n\n' +
            `כותרת הסעיף: ${title}\n` +
            `סוג המסמך: ${docGroup}\n\n` +
            `--- תוכן המסמך ---\n${text.slice(0, MAX_EXTRACT_CHARS)}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API ${response.status}`);
  }
  const data = (await response.json()) as {
    content?: { type: string; text?: string }[];
  };
  const summary = (data.content ?? [])
    .map((block) => (block.type === 'text' ? (block.text ?? '') : ''))
    .join('')
    .trim();
  return summary || null;
}

async function processItem(
  item: KnessetItem,
  voteTitle: string,
  result: KnessetDocsSyncResult
): Promise<void> {
  const docs = await fetchItemDocuments(item);
  const { extractable, linkable } = pickDocument(docs);

  if (!linkable?.FilePath) {
    // Nothing attached upstream — stamp the attempt so we don't retry forever.
    await updateKnessetItemDocSummary(item.id, { doc_group: null });
    result.docless += 1;
    return;
  }

  const docUrl = normalizeDocUrl(linkable.FilePath);
  const docGroup = (extractable ?? linkable).GroupTypeDesc ?? null;

  let summary: string | null = null;
  if (extractable?.FilePath) {
    const bytes = await downloadDoc(normalizeDocUrl(extractable.FilePath));
    const text = bytes ? extractDocxText(bytes) : '';
    if (text.length > 200) {
      summary = await summarizeDocument(voteTitle, docGroup ?? 'מסמך', text);
    }
  }

  await updateKnessetItemDocSummary(item.id, {
    doc_url: docUrl,
    doc_group: docGroup,
    summary,
    summary_model: summary ? ANTHROPIC_MODEL : null,
  });
  if (summary) result.summarized += 1;
  else result.docOnly += 1;
}

/** Process the next batch of items lacking a document summary. */
export async function syncKnessetDocSummaries(
  limit = ITEMS_PER_RUN
): Promise<KnessetDocsSyncResult> {
  const result: KnessetDocsSyncResult = {
    scanned: 0,
    summarized: 0,
    docOnly: 0,
    docless: 0,
    errors: [],
  };

  // Without the API key every item would be stamped "attempted" with no
  // summary and never retried — keep the queue intact until the key exists.
  if (!process.env.ANTHROPIC_API_KEY) {
    log.warn('knesset-docs: ANTHROPIC_API_KEY not set — skipping run');
    result.errors.push('ANTHROPIC_API_KEY not configured');
    return result;
  }

  const pending = await getKnessetItemsPendingSummary(limit);

  for (const item of pending) {
    result.scanned += 1;
    try {
      // The vote title doubles as the item title (that's how sync created it).
      await processItem(item, item.votes?.title ?? '', result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Leave summarized_at unset — transient failures get retried next run.
      result.errors.push(`item ${item.item_id}: ${message}`);
    }
  }

  return result;
}
