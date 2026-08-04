/**
 * Knesset document summaries — pulls the official document attached to each
 * day-order item (bill text / agenda-proposal text) from fs.knesset.gov.il,
 * extracts its text and stores a short Hebrew summary on knesset_items, so
 * the vote page can explain what is actually on the table.
 *
 * Runs on the Claude Agent SDK with local Claude Code credentials — no
 * ANTHROPIC_API_KEY. This job used to live in the Cloudflare Worker as the
 * /api/cron/knesset-docs route, which forced a raw Anthropic API call: the
 * Agent SDK spawns the `claude` CLI as a child process and reads credentials
 * from disk, and a Worker isolate has neither. Moving it next to the ranker
 * removed the last API-key dependency.
 *
 * Work-queue semantics: items never attempted come first, and every attempt
 * stamps summarized_at (even doc-less ones), so repeated runs converge
 * instead of re-grinding the same rows.
 */

import { unzipSync, strFromU8 } from 'fflate';
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabase, isEntryPoint, loadAgentEnv, numberArg } from './env.js';
import {
  fetchAgendaDocuments,
  fetchBillDocuments,
  type KnsDocument,
} from './knesset-odata.js';

loadAgentEnv();

const DOWNLOAD_TIMEOUT_MS = 20_000;
const MAX_DOC_BYTES = 4 * 1024 * 1024;
/** Claude gets at most this much extracted text per document. */
const MAX_EXTRACT_CHARS = 18_000;
/** Below this, the extraction produced nothing worth summarizing. */
const MIN_EXTRACT_CHARS = 200;
const SUMMARY_MODEL_TAG = 'claude-agent-sdk';

interface CliOptions {
  limit: number;
  dryRun: boolean;
  model?: string;
}

/** A knesset_items row awaiting a document attempt. */
interface PendingItem {
  id: string;
  itemId: number;
  itemType: string | null;
  title: string;
}

export interface DocsSyncResult {
  scanned: number;
  summarized: number;
  docOnly: number;
  docless: number;
  errors: string[];
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    limit: 12,
    dryRun: false,
    model: process.env.RANKER_MODEL,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--limit') options.limit = numberArg(argv[++i], options.limit);
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--model') options.model = argv[++i] || options.model;
  }
  return options;
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
  return { extractable, linkable: extractable ?? ranked[0] ?? null };
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

/** Look up the attachment table matching the item's day-order type. */
async function fetchItemDocuments(item: PendingItem): Promise<KnsDocument[]> {
  const type = item.itemType ?? '';
  if (type.includes('חוק')) return fetchBillDocuments(item.itemId);
  if (type.includes('לסדר היום')) return fetchAgendaDocuments(item.itemId);
  // Generic plenum items ('פריטי מליאה' etc.) — try both identities.
  const [bills, agenda] = await Promise.all([
    fetchBillDocuments(item.itemId).catch(() => []),
    fetchAgendaDocuments(item.itemId).catch(() => []),
  ]);
  return [...bills, ...agenda];
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

export function buildSummaryPrompt(
  title: string,
  docGroup: string,
  text: string
): string {
  return (
    'אתה עורך בדסק פרלמנטרי של עיתון אזרחי. סכם בעברית, בניסוח ניטרלי ' +
    'ובהיר לקורא שאינו משפטן, את המסמך הרשמי הבא מסדר היום של מליאת ' +
    'הכנסת. 2 עד 4 משפטים: מה מוצע לשנות או לקבוע, את מי זה נוגע, ' +
    'ומה ההקשר (הוראת שעה, תיקון, הצעה לדיון וכו׳). בלי דעה, בלי ' +
    'קריאה לפעולה, בלי פתיחים כמו "המסמך עוסק ב...". החזר את הסיכום ' +
    'בלבד.\n\n' +
    `כותרת הסעיף: ${title}\n` +
    `סוג המסמך: ${docGroup}\n\n` +
    `--- תוכן המסמך ---\n${text.slice(0, MAX_EXTRACT_CHARS)}`
  );
}

/**
 * Neutral civic-press summary in Hebrew. No tools: the document text is in
 * the prompt and the agent has nothing to look up.
 */
async function summarizeDocument(
  title: string,
  docGroup: string,
  text: string,
  model?: string
): Promise<string | null> {
  const stream = query({
    prompt: buildSummaryPrompt(title, docGroup, text),
    options: {
      allowedTools: [],
      permissionMode: 'bypassPermissions',
      maxTurns: 1,
      ...(model ? { model } : {}),
    },
  });

  for await (const message of stream) {
    if (message.type === 'result') {
      if (message.subtype !== 'success') {
        throw new Error(`agent finished without success: ${message.subtype}`);
      }
      return message.result.trim() || null;
    }
  }
  throw new Error('agent stream ended without a result message');
}

/** knesset_items rows never attempted, oldest first. */
async function fetchPending(
  supabase: SupabaseClient,
  limit: number
): Promise<PendingItem[]> {
  const { data, error } = await supabase
    .from('knesset_items')
    .select('id, item_id, item_type, votes(title)')
    .is('summarized_at', null)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw new Error(`pending query failed: ${error.message}`);

  return (data ?? []).map((row) => {
    const vote = Array.isArray(row.votes) ? row.votes[0] : row.votes;
    return {
      id: row.id as string,
      itemId: row.item_id as number,
      itemType: (row.item_type as string | null) ?? null,
      // The vote title doubles as the item title (that's how sync created it).
      title: ((vote as { title?: string } | null)?.title ?? '') as string,
    };
  });
}

/** Record a document attempt (also marks doc-less items as done). */
async function recordAttempt(
  supabase: SupabaseClient,
  id: string,
  patch: {
    doc_url?: string | null;
    doc_group?: string | null;
    summary?: string | null;
    summary_model?: string | null;
  }
): Promise<void> {
  const { error } = await supabase
    .from('knesset_items')
    .update({
      ...patch,
      summarized_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw new Error(`update failed: ${error.message}`);
}

async function processItem(
  supabase: SupabaseClient,
  item: PendingItem,
  options: CliOptions,
  result: DocsSyncResult
): Promise<void> {
  const docs = await fetchItemDocuments(item);
  const { extractable, linkable } = pickDocument(docs);

  if (!linkable?.FilePath) {
    console.log(`  — no document upstream: ${item.title.slice(0, 60)}`);
    // Nothing attached upstream — stamp the attempt so we don't retry forever.
    if (!options.dryRun) await recordAttempt(supabase, item.id, { doc_group: null });
    result.docless += 1;
    return;
  }

  const docUrl = normalizeDocUrl(linkable.FilePath);
  const docGroup = (extractable ?? linkable).GroupTypeDesc ?? null;

  let summary: string | null = null;
  if (extractable?.FilePath) {
    const bytes = await downloadDoc(normalizeDocUrl(extractable.FilePath));
    const text = bytes ? extractDocxText(bytes) : '';
    if (text.length > MIN_EXTRACT_CHARS) {
      summary = await summarizeDocument(
        item.title,
        docGroup ?? 'מסמך',
        text,
        options.model
      );
    }
  }

  console.log(
    summary
      ? `  ✓ ${item.title.slice(0, 50)} — ${summary.slice(0, 70)}…`
      : `  · doc only (${docGroup ?? 'לא ידוע'}): ${item.title.slice(0, 50)}`
  );

  if (!options.dryRun) {
    await recordAttempt(supabase, item.id, {
      doc_url: docUrl,
      doc_group: docGroup,
      summary,
      summary_model: summary ? SUMMARY_MODEL_TAG : null,
    });
  }
  if (summary) result.summarized += 1;
  else result.docOnly += 1;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const supabase = createSupabase();
  const pending = await fetchPending(supabase, options.limit);

  const result: DocsSyncResult = {
    scanned: 0,
    summarized: 0,
    docOnly: 0,
    docless: 0,
    errors: [],
  };

  console.log(`knesset-docs: ${pending.length} items pending (limit=${options.limit})`);

  for (const item of pending) {
    result.scanned += 1;
    try {
      await processItem(supabase, item, options, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Leave summarized_at unset — transient failures get retried next run.
      console.error(`  item ${item.itemId} failed, will retry next run: ${message}`);
      result.errors.push(`item ${item.itemId}: ${message}`);
    }
  }

  console.log(
    `${options.dryRun ? 'dry run — nothing written' : 'done'} — scanned ${result.scanned}, summarized ${result.summarized}, doc-only ${result.docOnly}, doc-less ${result.docless}, errors ${result.errors.length}`
  );
}

if (isEntryPoint(import.meta.url)) {
  main().catch((error) => {
    console.error('knesset-docs failed:', error);
    process.exit(1);
  });
}
