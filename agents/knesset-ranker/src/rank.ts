/**
 * Knesset ranker — scores every active Knesset vote for editorial hotness.
 *
 * Pipeline: pull active votes scoped to the Knesset desk (title + the AI
 * document summary produced by /api/cron/knesset-docs) → hand batches to a
 * Claude agent that judges how relevant/pressing each item is to the
 * Israeli public and hunts live press coverage with WebSearch → the CODE
 * (src/media.ts) HTTP-validates every ref, counts distinct fresh Israeli
 * outlets, computes the media sub-score from that count and blends hotness
 * 60/40 with relevance → upsert into knesset_rankings with the full
 * search-and-count evidence in media_evidence.
 *
 * Runs on the Claude Agent SDK with local Claude Code credentials — no
 * ANTHROPIC_API_KEY required. Safe to re-run: votes ranked within
 * --stale-hours are skipped.
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { query } from '@anthropic-ai/claude-agent-sdk';
import {
  FRESH_DAYS,
  MAX_COVERAGE_PER_VOTE,
  MAX_QUERIES,
  type CoverageClaim,
  blendHotness,
  buildEvidence,
  mediaScoreFromOutletCount,
  refsForDisplay,
} from './media.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Own env first, then the web app's — never overriding what's already set.
// (.dev.vars carries the real local Supabase creds; .env.local is a placeholder.)
// Empty values (a copied .env.example) must not shadow the fallback files,
// and dotenv never overrides an existing key — so drop empties between loads.
const dropEmptyEnv = () => {
  for (const key of [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
  ]) {
    if (process.env[key] === '') delete process.env[key];
  }
};
loadEnv({ path: resolve(__dirname, '../.env') });
dropEmptyEnv();
loadEnv({ path: resolve(__dirname, '../../../apps/web/.dev.vars') });
dropEmptyEnv();
loadEnv({ path: resolve(__dirname, '../../../apps/web/.env.local') });
dropEmptyEnv();

const KNESSET_SCOPE = 'כנסת ישראל';
const BATCH_SIZE = 6;
const MODEL_TAG = 'claude-agent-sdk+counted-media/v2';

interface CliOptions {
  limit: number;
  staleHours: number;
  dryRun: boolean;
}

interface RankableVote {
  id: string;
  title: string;
  itemType: string | null;
  summary: string | null;
}

/** The agent's judgment + evidence for one vote — scores come later. */
export interface AgentFinding {
  voteId: string;
  relevance: number;
  rationale: string;
  queries: string[];
  coverage: CoverageClaim[];
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { limit: 12, staleHours: 24, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--limit') options.limit = Number(argv[++i]) || options.limit;
    else if (arg === '--stale-hours')
      options.staleHours = Number(argv[++i]) || options.staleHours;
    else if (arg === '--dry-run') options.dryRun = true;
  }
  return options;
}

function requireEnv(): { url: string; serviceKey: string } {
  // NEXT_PUBLIC_ first: apps/web/.env.local carries a placeholder SUPABASE_URL.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(
      'Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (set in env or apps/web/.env.local)'
    );
    process.exit(1);
  }
  return { url, serviceKey };
}

const clamp = (n: unknown): number =>
  Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

function buildPrompt(votes: RankableVote[]): string {
  const items = votes
    .map((vote, i) => {
      const lines = [
        `${i + 1}. voteId: ${vote.id}`,
        `   כותרת: ${vote.title}`,
        `   סוג: ${vote.itemType ?? 'לא ידוע'}`,
      ];
      if (vote.summary) lines.push(`   תקציר המסמך: ${vote.summary}`);
      return lines.join('\n');
    })
    .join('\n\n');

  return `אתה עורך ראשי בדסק פרלמנטרי של עיתון אזרחי ישראלי. לפניך סעיפים מסדר היום של מליאת הכנסת. לכל סעיף בצע שתי משימות:

1. relevance (0–100): שפוט עד כמה הנושא רלוונטי ודוחק לציבור הישראלי הרחב — השפעה ישירה על חיי היומיום, היקף האוכלוסייה המושפעת, דחיפות בזמן. נושאים טכניים/פרוצדורליים (הצהרות אמונים, הארכות תוקף שגרתיות) נמוכים אלא אם יש סערה ציבורית סביבם.

2. איסוף סיקור: חפש באמצעות WebSearch סיקור עיתונאי ישראלי מה־${FRESH_DAYS} הימים האחרונים (חפש בעברית: מילות מפתח מהכותרת, עם "חדשות" או שם אתר). לפחות חיפוש אחד לכל סעיף. החזר אך ורק כתובות URL אמיתיות שהופיעו בתוצאות החיפוש — לעולם אל תמציא ואל תשחזר כתובת מהזיכרון. לכל כתובת צרף תאריך פרסום בפורמט YYYY-MM-DD אם הוא מופיע בתוצאה (אחרת null). עד ${MAX_COVERAGE_PER_VOTE} כתובות לסעיף, מאתרי חדשות ישראליים בלבד. כלול גם את שאילתות החיפוש שהרצת (עד ${MAX_QUERIES}).

אל תחשב ציון תקשורת ואל תחשב hotness — המערכת סופרת את הסיקור המאומת ומחשבת בעצמה.

החזר JSON בלבד — מערך, בלי טקסט נוסף ובלי גדרות קוד:
[{"voteId": "...", "relevance": 0, "rationale": "משפט אחד בעברית", "queries": ["..."], "coverage": [{"url": "https://...", "publishedAt": "YYYY-MM-DD או null"}]}]

הסעיפים:

${items}`;
}

/** One agent session per batch; returns the agent's final text. */
async function runAgent(prompt: string): Promise<string> {
  const stream = query({
    prompt,
    options: {
      allowedTools: ['WebSearch'],
      permissionMode: 'bypassPermissions',
      maxTurns: 40,
    },
  });

  for await (const message of stream) {
    if (message.type === 'result') {
      if (message.subtype === 'success') return message.result;
      throw new Error(`agent finished without success: ${message.subtype}`);
    }
  }
  throw new Error('agent stream ended without a result message');
}

/** Strip optional code fences and validate the agent's JSON against the batch. */
export function parseFindings(raw: string, batch: RankableVote[]): AgentFinding[] {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '');
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end <= start) {
    // Surface what the agent actually said — e.g. "Not logged in".
    throw new Error(`no JSON array in agent output: "${cleaned.slice(0, 160)}"`);
  }

  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as unknown;
  if (!Array.isArray(parsed)) throw new Error('agent output is not an array');

  const validIds = new Set(batch.map((v) => v.id));
  const findings: AgentFinding[] = [];
  for (const entry of parsed) {
    const e = entry as Record<string, unknown>;
    const voteId = String(e.voteId ?? '');
    if (!validIds.has(voteId)) continue;
    findings.push({
      voteId,
      relevance: clamp(e.relevance),
      rationale: String(e.rationale ?? '').slice(0, 500),
      queries: (Array.isArray(e.queries) ? e.queries : [])
        .map((q) => String(q).trim())
        .filter(Boolean)
        .slice(0, MAX_QUERIES),
      coverage: (Array.isArray(e.coverage) ? e.coverage : [])
        .map((c) => {
          const item = c as Record<string, unknown>;
          const url = String(item.url ?? '');
          const publishedAt =
            typeof item.publishedAt === 'string' &&
            /^\d{4}-\d{2}-\d{2}/.test(item.publishedAt)
              ? item.publishedAt
              : null;
          return { url, publishedAt };
        })
        .filter((c) => /^https?:\/\//.test(c.url))
        .slice(0, MAX_COVERAGE_PER_VOTE),
    });
  }
  return findings;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const { url, serviceKey } = requireEnv();
  const supabase = createClient(url, serviceKey);

  // Active Knesset votes with their document summaries.
  const { data: votes, error: votesError } = await supabase
    .from('votes')
    .select('id, title, knesset_items(summary, item_type)')
    .eq('municipality_id', KNESSET_SCOPE)
    .eq('status', 'active');
  if (votesError) throw new Error(`votes query failed: ${votesError.message}`);

  // Skip votes ranked recently — the script is schedule-safe.
  const staleBefore = new Date(
    Date.now() - options.staleHours * 3_600_000
  ).toISOString();
  const { data: fresh, error: rankError } = await supabase
    .from('knesset_rankings')
    .select('vote_id, ranked_at')
    .gte('ranked_at', staleBefore);
  if (rankError) throw new Error(`rankings query failed: ${rankError.message}`);
  const freshIds = new Set((fresh ?? []).map((r) => r.vote_id as string));

  const rankable: RankableVote[] = (votes ?? [])
    .filter((v) => !freshIds.has(v.id as string))
    .slice(0, options.limit)
    .map((v) => {
      const item = Array.isArray(v.knesset_items)
        ? v.knesset_items[0]
        : v.knesset_items;
      return {
        id: v.id as string,
        title: v.title as string,
        itemType: (item?.item_type as string | null) ?? null,
        summary: (item?.summary as string | null) ?? null,
      };
    });

  console.log(
    `knesset-ranker: ${votes?.length ?? 0} active votes, ${rankable.length} to rank (stale-hours=${options.staleHours}, limit=${options.limit})`
  );
  if (rankable.length === 0) return;

  let written = 0;
  for (const batch of chunk(rankable, BATCH_SIZE)) {
    console.log(`ranking batch of ${batch.length}…`);
    const output = await runAgent(buildPrompt(batch));
    const findings = parseFindings(output, batch);
    console.log(`  agent returned ${findings.length}/${batch.length} findings`);

    for (const finding of findings) {
      const title = batch.find((v) => v.id === finding.voteId)?.title ?? '';
      const evidence = await buildEvidence(
        finding.queries,
        finding.coverage,
        new Date()
      );
      const media = mediaScoreFromOutletCount(evidence.outletsCounted);
      const hotness = blendHotness(finding.relevance, media);
      const dead = evidence.hits.filter((h) => !h.ok).length;

      console.log(
        `  ${String(hotness).padStart(3)}° (rel ${finding.relevance}, media ${media} ← ${evidence.outletsCounted} outlets, ${evidence.hits.length} refs${dead ? `, ${dead} dead` : ''}) ${title.slice(0, 60)}`
      );
      if (options.dryRun) continue;

      const { error } = await supabase.from('knesset_rankings').upsert(
        {
          vote_id: finding.voteId,
          hotness,
          relevance: finding.relevance,
          media,
          rationale: finding.rationale,
          media_refs: refsForDisplay(evidence),
          media_evidence: evidence,
          model: MODEL_TAG,
          ranked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'vote_id' }
      );
      if (error)
        console.error(`  upsert failed for ${finding.voteId}: ${error.message}`);
      else written += 1;
    }
  }

  console.log(
    options.dryRun
      ? 'dry run — nothing written'
      : `done — ${written} rankings written`
  );
}

const isDirectRun =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((error) => {
    console.error('knesset-ranker failed:', error);
    process.exit(1);
  });
}
