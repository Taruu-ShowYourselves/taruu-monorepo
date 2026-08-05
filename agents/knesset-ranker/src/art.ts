/**
 * Card-art generator — one duotone background plate per active vote.
 *
 * Pipeline: pull active votes (all desks) that have no fresh plate → a Claude
 * agent turns each Hebrew title+description into one concrete English scene
 * line (objects only, no typography) → the scene is wrapped in the house
 * style — two-colour risograph, black ink + pillarbox red on newsprint cream,
 * halftone (the recipe behind the merch/certificate plates, commit c84fe55)
 * → Seedream (fal.ai) renders it → sharp downscales to a web-weight WebP →
 * uploaded to the public `vote-art` bucket and recorded in vote_card_art.
 *
 * The scene step runs on the Claude Agent SDK with local Claude Code
 * credentials (no API key); the render step needs FAL_KEY. Safe to re-run:
 * plates already generated are permanent, failed attempts retry once stale.
 *
 * Cost: Seedream v4 text-to-image ≈ $0.03/plate; --limit caps a run's spend.
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import sharp from 'sharp';
import { createSupabase, isEntryPoint, loadAgentEnv, numberArg } from './env.js';
import { isFatalAgentFailure } from './rank.js';

loadAgentEnv();

const BATCH_SIZE = 8;
const FAL_MODEL = 'fal-ai/bytedance/seedream/v4/text-to-image';
const MODEL_TAG = `${FAL_MODEL}+claude-scene/v1`;
const BUCKET = 'vote-art';
/** Web weight: tiles print the plate at ~14% opacity — 800px WebP is plenty. */
const PLATE_SIZE = 800;
const WEBP_QUALITY = 72;

/**
 * The house style around the per-vote scene. Kept verbatim-close to the
 * recipe that produced the store/certificate plates so every generated
 * surface on the site prints from the same press.
 */
const STYLE_PREFIX =
  'Two-color risograph screenprint, black ink and pillarbox red on newsprint cream paper, ' +
  'coarse halftone dots, brutalist civic linocut engraving style, bold flat shapes, ' +
  'high contrast, grainy paper texture.';
const STYLE_SUFFIX =
  'No text, no letters, no words, no numbers, no typography, no watermark.';

export function buildPlatePrompt(scene: string): string {
  return `${STYLE_PREFIX} ${scene.trim().replace(/\.?$/, '.')} ${STYLE_SUFFIX}`;
}

interface CliOptions {
  limit: number;
  /** Failed attempts younger than this are left alone. */
  retryHours: number;
  dryRun: boolean;
  /** Scene-writer model override (Agent SDK). */
  model?: string;
}

interface ArtableVote {
  id: string;
  title: string;
  description: string;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    limit: 12,
    retryHours: 24,
    dryRun: false,
    model: process.env.RANKER_MODEL,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--limit') options.limit = numberArg(argv[++i], options.limit);
    else if (arg === '--retry-hours')
      options.retryHours = numberArg(argv[++i], options.retryHours);
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--model') options.model = argv[++i] || options.model;
  }
  return options;
}

function buildScenePrompt(votes: ArtableVote[]): string {
  const items = votes
    .map(
      (vote, i) =>
        `${i + 1}. voteId: ${vote.id}\n   כותרת: ${vote.title}\n   תיאור: ${vote.description}`
    )
    .join('\n\n');

  return `You write art briefs for a civic newspaper's illustration desk. For each Hebrew vote topic below, write ONE English scene line for an image model: the concrete physical subject of the topic as objects in a scene (e.g. "a protected bicycle lane divided from the sidewalk by concrete planters, cyclists passing city buildings"). Rules: 10-25 words; concrete nouns only; no people's names, no party names, no flags, no text or signs in the scene; neutral — depict the subject, not a side of the argument.

Return JSON only — an array, no prose, no code fences:
[{"voteId": "...", "scene": "..."}]

Topics:

${items}`;
}

/** One agent session per batch; returns the agent's final text. */
async function runSceneAgent(prompt: string, model?: string): Promise<string> {
  const stream = query({
    prompt,
    options: {
      allowedTools: [],
      permissionMode: 'bypassPermissions',
      maxTurns: 4,
      ...(model ? { model } : {}),
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
export function parseScenes(
  raw: string,
  batch: ArtableVote[]
): Map<string, string> {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '');
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end <= start) {
    throw new Error(`no JSON array in agent output: "${cleaned.slice(0, 160)}"`);
  }

  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as unknown;
  if (!Array.isArray(parsed)) throw new Error('agent output is not an array');

  const validIds = new Set(batch.map((v) => v.id));
  const scenes = new Map<string, string>();
  for (const entry of parsed) {
    const e = entry as Record<string, unknown>;
    const voteId = String(e.voteId ?? '');
    const scene =
      typeof e.scene === 'string' ? e.scene.replace(/\s+/g, ' ').trim() : '';
    // A scene the model padded past the brief is a scene it invented detail
    // for; an empty one renders the style prefix alone. Both fall back to
    // nothing and the vote is retried next run.
    if (validIds.has(voteId) && scene.length >= 10 && scene.length <= 300) {
      scenes.set(voteId, scene);
    }
  }
  return scenes;
}

/** Render one plate through fal.ai's synchronous endpoint. */
async function renderPlate(prompt: string, falKey: string): Promise<Buffer> {
  const res = await fetch(`https://fal.run/${FAL_MODEL}`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${falKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      image_size: { width: 1024, height: 1024 },
      num_images: 1,
      enable_safety_checker: true,
    }),
  });
  if (!res.ok) {
    throw new Error(`fal.ai ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }

  const body = (await res.json()) as { images?: Array<{ url?: string }> };
  const url = body.images?.[0]?.url;
  if (!url) throw new Error('fal.ai returned no image url');

  const image = await fetch(url);
  if (!image.ok) throw new Error(`plate download failed: ${image.status}`);
  return Buffer.from(await image.arrayBuffer());
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const supabase = createSupabase();

  const falKey = process.env.FAL_KEY;
  if (!falKey && !options.dryRun) {
    console.error('Missing FAL_KEY (set in env, agents/knesset-ranker/.env, or apps/web/.dev.vars)');
    process.exit(1);
  }

  const { data: votes, error: votesError } = await supabase
    .from('votes')
    .select('id, title, description')
    .eq('status', 'active');
  if (votesError) throw new Error(`votes query failed: ${votesError.message}`);

  const { data: art, error: artError } = await supabase
    .from('vote_card_art')
    .select('vote_id, generated_at, attempted_at');
  if (artError) throw new Error(`art query failed: ${artError.message}`);

  // A plate is permanent; a failed attempt cools off for --retry-hours.
  const retryBefore = Date.now() - options.retryHours * 3_600_000;
  const settled = new Set(
    (art ?? [])
      .filter(
        (row) =>
          row.generated_at !== null ||
          new Date(row.attempted_at as string).getTime() > retryBefore
      )
      .map((row) => row.vote_id as string)
  );

  const artable: ArtableVote[] = (votes ?? [])
    .filter((v) => !settled.has(v.id as string))
    .slice(0, options.limit)
    .map((v) => ({
      id: v.id as string,
      title: v.title as string,
      description: (v.description as string | null) ?? '',
    }));

  console.log(
    `card-art: ${votes?.length ?? 0} active votes, ${artable.length} to plate (retry-hours=${options.retryHours}, limit=${options.limit}, ~$${(artable.length * 0.03).toFixed(2)})`
  );
  if (artable.length === 0) return;

  let written = 0;
  let skipped = 0;
  const batches: ArtableVote[][] = [];
  for (let i = 0; i < artable.length; i += BATCH_SIZE)
    batches.push(artable.slice(i, i + BATCH_SIZE));

  for (const [index, batch] of batches.entries()) {
    console.log(`scenes batch ${index + 1}/${batches.length} (${batch.length} items)…`);

    let scenes: Map<string, string>;
    try {
      scenes = parseScenes(
        await runSceneAgent(buildScenePrompt(batch), options.model),
        batch
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isFatalAgentFailure(message)) {
        skipped += batches
          .slice(index)
          .reduce((total, pending) => total + pending.length, 0);
        console.error(`  fatal — stopping run: ${message}`);
        break;
      }
      skipped += batch.length;
      console.error(`  batch failed, continuing: ${message}`);
      continue;
    }
    console.log(`  agent returned ${scenes.size}/${batch.length} scenes`);

    for (const vote of batch) {
      const scene = scenes.get(vote.id);
      if (!scene) {
        skipped += 1;
        continue;
      }
      const prompt = buildPlatePrompt(scene);
      console.log(`  ${vote.title.slice(0, 50)}\n    → ${scene}`);
      if (options.dryRun) continue;

      // Stamp the attempt before rendering: a crash mid-render must not make
      // the next run re-spend on the same vote inside the cooldown.
      const attempt = {
        vote_id: vote.id,
        prompt,
        model: MODEL_TAG,
        attempted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await supabase
        .from('vote_card_art')
        .upsert(attempt, { onConflict: 'vote_id' });

      try {
        const raw = await renderPlate(prompt, falKey as string);
        const webp = await sharp(raw)
          .resize(PLATE_SIZE, PLATE_SIZE, { fit: 'cover' })
          .webp({ quality: WEBP_QUALITY })
          .toBuffer();

        const path = `${vote.id}.webp`;
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, webp, { contentType: 'image/webp', upsert: true });
        if (uploadError) throw new Error(`upload failed: ${uploadError.message}`);

        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
        const { error: upsertError } = await supabase
          .from('vote_card_art')
          .upsert(
            {
              ...attempt,
              image_url: pub.publicUrl,
              generated_at: new Date().toISOString(),
            },
            { onConflict: 'vote_id' }
          );
        if (upsertError) throw new Error(`record failed: ${upsertError.message}`);
        written += 1;
        console.log(`    plate stored (${Math.round(webp.length / 1024)}KB)`);
      } catch (error) {
        skipped += 1;
        console.error(
          `    plate failed for ${vote.id}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  const remainder = skipped ? `, ${skipped} left unplated` : '';
  console.log(
    options.dryRun
      ? `dry run — nothing rendered${remainder}`
      : `done — ${written} plates written${remainder}`
  );
}

if (isEntryPoint(import.meta.url)) {
  main().catch((error) => {
    console.error('card-art failed:', error);
    process.exit(1);
  });
}
