import { NextRequest, NextResponse } from 'next/server';
import { KNESSET_SCOPE, MUNICIPALITIES } from '@sync/shared';
import {
  activateIngestVote,
  createVote,
  ensureIngestVoteOptions,
  findVoteByMunicipalityAndTitle,
  upsertVoteSource,
} from '@/lib/supabase/db';
import { UniqueViolationError } from '@/lib/supabase/errors';
import { secureEqual } from '@/lib/secureCompare';

const INGEST_SECRET = process.env.INGEST_SECRET;
// System editorial user that owns discovery-created votes (seeded desk user
// by default; override with INGEST_CREATOR_ID).
const INGEST_CREATOR_ID =
  process.env.INGEST_CREATOR_ID ?? '99999999-9999-4999-8999-999999999999';

// The instant this deployment's automatic activation starts applying. Rows
// created BEFORE it - the pending backlog that accumulated while no activation
// step existed - are deliberately out of scope for this change and are left
// exactly as they are. Required: without it the route cannot tell a fresh vote
// from a backlog row, and guessing in either direction is wrong.
const INGEST_AUTOACTIVATE_SINCE = process.env.INGEST_AUTOACTIVATE_SINCE;

const DEFAULT_OPTIONS = ['בעד', 'נגד', 'נמנע'];
const DEFAULT_VOTE_DAYS = 14;
const MIN_VOTE_DAYS = 1;
// A ballot open for over a year is a malformed request, not a long campaign.
const MAX_VOTE_DAYS = 365;
// Fewer than two distinct choices is not a ballot. Mirrored in
// `activate_ingest_vote` so the database refuses it too.
const MIN_VOTE_OPTIONS = 2;
const MAX_TOPICS_PER_CALL = 50;

const REACTION_KINDS = new Set(['like', 'love', 'haha', 'wow', 'sad', 'angry']);

interface IngestTopic {
  municipality: string;
  title: string;
  description: string;
  options?: string[];
  /** Consolidated FB engagement across the source post(s). */
  source: {
    post_count: number;
    comments_count: number;
    reactions: Record<string, number>;
    source_url?: string | null;
  };
  /** Days the ballot stays open when this call creates the vote. */
  vote_days?: number;
}

function invalid(topic: unknown): string | null {
  const t = topic as Partial<IngestTopic>;
  if (!t || typeof t !== 'object') return 'topic must be an object';
  if (typeof t.municipality !== 'string' || !t.municipality.trim())
    return 'municipality required';
  if (
    !(MUNICIPALITIES as readonly string[]).includes(t.municipality) &&
    t.municipality !== KNESSET_SCOPE
  )
    return `unknown municipality: ${t.municipality}`;
  if (typeof t.title !== 'string' || t.title.trim().length < 4)
    return 'title required (min 4 chars)';
  if (typeof t.description !== 'string' || !t.description.trim())
    return 'description required';
  if (t.options !== undefined) {
    if (!Array.isArray(t.options))
      return `options must be an array of at least ${MIN_VOTE_OPTIONS}`;
    if (t.options.some((option) => typeof option !== 'string'))
      return 'every option must be a string';
    // Distinct AFTER trimming: "  בעד " and "בעד" are one choice, and a blank
    // string is none. The ballot the resident sees is what has to be countable,
    // not the array length the caller happened to send.
    const usable = new Set(
      (t.options as string[]).map((option) => option.trim()).filter(Boolean)
    );
    if (usable.size < MIN_VOTE_OPTIONS)
      return `options must contain at least ${MIN_VOTE_OPTIONS} distinct non-empty values`;
  }
  if (t.vote_days !== undefined) {
    // Drives end_date. A non-positive value produces a ballot that closed
    // before it opened, which `activate_ingest_vote` would then refuse - fail
    // here, on the request that is actually wrong, instead of after the write.
    if (!Number.isInteger(t.vote_days))
      return 'vote_days must be an integer';
    if (t.vote_days < MIN_VOTE_DAYS || t.vote_days > MAX_VOTE_DAYS)
      return `vote_days must be between ${MIN_VOTE_DAYS} and ${MAX_VOTE_DAYS}`;
  }
  const s = t.source;
  if (!s || typeof s !== 'object') return 'source required';
  if (!Number.isInteger(s.post_count) || s.post_count < 1)
    return 'source.post_count must be int >= 1';
  if (!Number.isInteger(s.comments_count) || s.comments_count < 0)
    return 'source.comments_count must be int >= 0';
  if (!s.reactions || typeof s.reactions !== 'object')
    return 'source.reactions required';
  for (const [kind, count] of Object.entries(s.reactions)) {
    if (!REACTION_KINDS.has(kind)) return `unknown reaction kind: ${kind}`;
    if (!Number.isInteger(count) || (count as number) < 0)
      return `reaction ${kind} must be int >= 0`;
  }
  return null;
}

/** The configured cutover as epoch ms, or null when unset/unparseable. */
function activationCutover(): { iso: string; ms: number } | null {
  if (!INGEST_AUTOACTIVATE_SINCE) return null;
  const ms = Date.parse(INGEST_AUTOACTIVATE_SINCE);
  if (!Number.isFinite(ms)) return null;
  return { iso: new Date(ms).toISOString(), ms };
}

/**
 * Is this row one this deployment is allowed to publish automatically?
 *
 * `created` short-circuits: a row this request just inserted is current by
 * definition, so a missing or unreadable `created_at` can never demote it to
 * the backlog and strand it.
 */
function withinActivationScope(
  vote: { created_at?: string | null },
  created: boolean,
  cutoverMs: number
): boolean {
  if (created) return true;
  const createdAt = vote.created_at ? Date.parse(vote.created_at) : Number.NaN;
  return Number.isFinite(createdAt) && createdAt >= cutoverMs;
}

/**
 * POST /api/ingest/topics - discovery-fleet ingestion.
 *
 * The taruu-agents discovery pipeline pulls civic topics + engagement from
 * Facebook and posts them here. Existing (municipality, title) votes get
 * their source metrics refreshed; new topics become pending votes with the
 * consolidated engagement attached. Auth: Bearer INGEST_SECRET.
 * Contract: docs/INGEST.md.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');

  if (!INGEST_SECRET) {
    return NextResponse.json(
      { error: 'Ingest endpoint not configured' },
      { status: 503 }
    );
  }
  if (!authHeader || !secureEqual(authHeader, `Bearer ${INGEST_SECRET}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Below the credential check on purpose: answered above it, the difference
  // between this 503 and the 401 tells an unauthenticated caller whether
  // INGEST_AUTOACTIVATE_SINCE is set. Still before any write - running without
  // a cutover would create votes this route has no rule for activating, which
  // is the orphaned `pending` row this change exists to make impossible.
  const cutover = activationCutover();
  if (!cutover) {
    return NextResponse.json(
      { error: 'Ingest activation cutover not configured' },
      { status: 503 }
    );
  }

  let body: { topics?: unknown[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!Array.isArray(body.topics) || body.topics.length === 0) {
    return NextResponse.json({ error: 'topics[] required' }, { status: 400 });
  }
  if (body.topics.length > MAX_TOPICS_PER_CALL) {
    return NextResponse.json(
      { error: `max ${MAX_TOPICS_PER_CALL} topics per call` },
      { status: 400 }
    );
  }

  for (const [i, topic] of body.topics.entries()) {
    const problem = invalid(topic);
    if (problem) {
      return NextResponse.json(
        { error: `topics[${i}]: ${problem}` },
        { status: 400 }
      );
    }
  }

  const results: {
    title: string;
    vote_id: string;
    created: boolean;
    status: string;
  }[] = [];

  try {
    for (const raw of body.topics as IngestTopic[]) {
      let vote = await findVoteByMunicipalityAndTitle(
        raw.municipality,
        raw.title.trim()
      );
      let created = false;

      if (!vote) {
        const days = raw.vote_days ?? DEFAULT_VOTE_DAYS;
        try {
          vote = await createVote({
            creator_id: INGEST_CREATOR_ID,
            title: raw.title.trim(),
            description: raw.description.trim(),
            municipality_id: raw.municipality,
            status: 'pending',
            end_date: new Date(Date.now() + days * 86_400_000).toISOString(),
          });
          created = true;
        } catch (error) {
          // The lookup above and this insert are not one atomic step: a second
          // ingest run - or a retry of this one - can create the topic in
          // between. `ux_votes_live_topic` catches that, and the row the other
          // writer landed is exactly the row we wanted, so adopt it and carry
          // on refreshing its engagement.
          if (!(error instanceof UniqueViolationError)) throw error;
          vote = await findVoteByMunicipalityAndTitle(
            raw.municipality,
            raw.title.trim()
          );
          if (!vote) throw error;
        }
      }

      // Assembly, in order, on EVERY path - created or adopted. Option writing
      // used to live inside the create-only branch above, so a first attempt
      // that landed the vote row and then failed here left a `pending` vote
      // with no ballot; every retry deduped onto it, skipped this step, and was
      // refused by activation forever, wedging the batch behind it. The repair
      // is idempotent and adds only what is missing, so calling it on a vote
      // that already has its options is a no-op.
      const optionTexts = [
        ...new Set(
          (raw.options ?? DEFAULT_OPTIONS).map((text) => text.trim()).filter(Boolean)
        ),
      ];
      await ensureIngestVoteOptions(
        vote.id,
        INGEST_CREATOR_ID,
        cutover.iso,
        optionTexts
      );

      const source = await upsertVoteSource({
        vote_id: vote.id,
        post_count: raw.source.post_count,
        comments_count: raw.source.comments_count,
        reactions: raw.source.reactions,
        source_url: raw.source.source_url ?? null,
        fetched_at: new Date().toISOString(),
      });
      if (!source) {
        throw new Error(`source assembly failed for ingest vote ${vote.id}`);
      }

      // Publication is deliberately last, and deliberately NOT conditional on
      // `created`. A first attempt that died after the vote row but before the
      // source row leaves a real, current, half-assembled vote behind; the
      // retry arrives here as a dedup hit, finishes the assembly above, and
      // must be able to finish the lifecycle too. Gating this on `created` is
      // what left such a row stranded in `pending` while the response still
      // said `success: true`.
      //
      // The RPC re-checks the whole eligibility contract in one statement, so
      // application call order alone can never ACTIVATE a partial ballot.
      // ("Never expose" would overstate it: `pending` is still served by the
      // municipality-scoped read - see docs/INGEST.md.)
      // Widened deliberately: the RPC reports whichever lifecycle status the
      // row ended up in, and the response carries it through verbatim rather
      // than re-narrowing it to the statuses this route happens to know.
      let status: string = vote.status ?? 'pending';
      if (withinActivationScope(vote, created, cutover.ms)) {
        // The RPC answers with the status the row ACTUALLY holds afterwards.
        // It returns success for a vote that had already advanced to `ended`,
        // which is a completed lifecycle rather than an ingest failure - but
        // reporting that row as `active` would be a plain lie about its state.
        const activated = await activateIngestVote(
          vote.id,
          INGEST_CREATOR_ID,
          cutover.iso
        );
        if (!activated) {
          throw new Error(`ingest vote ${vote.id} was not eligible for activation`);
        }
        status = activated;
      }

      results.push({ title: vote.title, vote_id: vote.id, created, status });
    }
  } catch (error) {
    console.error('Ingest failed midway:', error);
    return NextResponse.json(
      { error: 'Ingest failed', ingested: results },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    ingested: results,
    timestamp: new Date().toISOString(),
  });
}
