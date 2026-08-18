import { NextRequest, NextResponse } from 'next/server';
import { KNESSET_SCOPE, MUNICIPALITIES } from '@sync/shared';
import {
  activateIngestVote,
  createVote,
  createVoteOptions,
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

const DEFAULT_OPTIONS = ['בעד', 'נגד', 'נמנע'];
const DEFAULT_VOTE_DAYS = 14;
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
  if (t.options && (!Array.isArray(t.options) || t.options.length < 2))
    return 'options must be an array of at least 2';
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

  const results: { title: string; vote_id: string; created: boolean }[] = [];

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
          await createVoteOptions(
            (raw.options ?? DEFAULT_OPTIONS).map((text) => ({
              vote_id: vote!.id,
              text: text.trim(),
            }))
          );
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

      // Publication is deliberately last. The RPC changes only this freshly
      // created machine vote and re-checks the complete options + source
      // assembly atomically in PostgreSQL before pending -> active.
      if (created) {
        const activated = await activateIngestVote(vote.id, INGEST_CREATOR_ID);
        if (!activated) {
          throw new Error(`new ingest vote ${vote.id} was not eligible for activation`);
        }
      }

      results.push({ title: vote.title, vote_id: vote.id, created });
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
