/**
 * Card-art generator — one duotone background plate per active vote.
 *
 * Pipeline: pull active votes (all desks) that have no fresh plate → a Claude
 * agent turns each Hebrew title+description into one concrete English scene
 * line (objects only, no typography) → the scene is wrapped in the house
 * style — two-colour risograph, black ink + pillarbox red on newsprint cream,
 * halftone (the recipe behind the merch/certificate plates, commit c84fe55)
 * → the Higgsfield CLI renders it (same account that produced those assets)
 * → sharp downscales to a web-weight WebP → uploaded to the public
 * `vote-art` bucket and recorded in vote_card_art.
 *
 * Both AI steps use local CLI credentials — Claude Code for scenes,
 * `higgsfield auth login` for renders; no API keys. Renders run
 * SEQUENTIALLY: the account caps concurrent jobs at 4 and the desk shares
 * it with hand-run generations (HANDOVER.md asset note). Safe to re-run:
 * plates already generated are permanent, failed attempts retry once stale.
 *
 * Cost: credits per render vary by model (gpt_image_2 ≈ 7); --image-model
 * picks the model, --limit caps a run's spend.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { query } from '@anthropic-ai/claude-agent-sdk';
import sharp from 'sharp';
import { createSupabase, isEntryPoint, loadAgentEnv, numberArg } from './env.js';
import { isFatalAgentFailure } from './rank.js';

const exec = promisify(execFile);

loadAgentEnv();

const BATCH_SIZE = 8;
/**
 * z_image: 0.15 credits/render vs gpt_image_2's 7 — and its ink+red
 * screenprint output holds the house style (checked 2026-08-05). Careful
 * renaming: on Higgsfield, `nano_banana_2` is Nano Banana PRO; the cheap
 * Nano Banana tiers are `nano_banana_flash` / `nano_banana_2_lite`.
 */
const DEFAULT_IMAGE_MODEL = process.env.HIGGSFIELD_IMAGE_MODEL || 'z_image';
const BUCKET = 'vote-art';
/** One render can sit in the queue behind hand-run jobs — wait generously. */
const RENDER_TIMEOUT = '10m';
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
  'All surfaces blank — no text, no letters, no words, no numbers, no inscriptions, no typography, no watermark.';

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
  /** Higgsfield image model (job_set_type). */
  imageModel: string;
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
    imageModel: DEFAULT_IMAGE_MODEL,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--limit') options.limit = numberArg(argv[++i], options.limit);
    else if (arg === '--retry-hours')
      options.retryHours = numberArg(argv[++i], options.retryHours);
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--model') options.model = argv[++i] || options.model;
    else if (arg === '--image-model')
      options.imageModel = argv[++i] || options.imageModel;
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

/** First https URL that looks like an image result in a CLI JSON payload. */
export function findImageUrl(value: unknown): string | null {
  if (typeof value === 'string') {
    return /^https:\/\//.test(value) &&
      /\.(png|jpe?g|webp)(\?|$)|image/i.test(value)
      ? value
      : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = findImageUrl(item);
      if (url) return url;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    // Prefer the conventional keys before sweeping the whole object.
    const record = value as Record<string, unknown>;
    for (const key of ['url', 'image_url', 'result_url', 'raw_url']) {
      const url = findImageUrl(record[key]);
      if (url) return url;
    }
    for (const nested of Object.values(record)) {
      const url = findImageUrl(nested);
      if (url) return url;
    }
  }
  return null;
}

/**
 * Render one plate through the Higgsfield CLI and return the image bytes.
 *
 * `--wait --json` blocks until the job settles and prints the job payload;
 * the result URL is fished out of the JSON rather than grepped from stdout
 * (HANDOVER.md: the --wait stdout grep is flaky).
 */
async function renderPlate(prompt: string, imageModel: string): Promise<Buffer> {
  const { stdout } = await exec(
    'higgsfield',
    [
      'generate',
      'create',
      imageModel,
      '--prompt',
      prompt,
      '--wait',
      '--wait-timeout',
      RENDER_TIMEOUT,
      '--json',
    ],
    { timeout: 12 * 60_000, maxBuffer: 8 * 1024 * 1024 }
  );

  // The CLI pretty-prints one JSON document across many lines; parse the
  // whole stream first and only fall back to line-scanning for the case of
  // several concatenated documents with noise between them.
  let url: string | null = null;
  try {
    url = findImageUrl(JSON.parse(stdout));
  } catch {
    for (const line of stdout.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) continue;
      try {
        url = findImageUrl(JSON.parse(trimmed)) ?? url;
      } catch {
        // Non-JSON noise between documents — ignore.
      }
    }
  }
  if (!url) {
    throw new Error(
      `no image url in higgsfield output: "${stdout.slice(0, 200)}"`
    );
  }

  const image = await fetch(url);
  if (!image.ok) throw new Error(`plate download failed: ${image.status}`);
  return Buffer.from(await image.arrayBuffer());
}

/** Fail the run up front when the render CLI is missing or logged out. */
async function assertHiggsfieldReady(): Promise<void> {
  try {
    await exec('higgsfield', ['account', 'status'], { timeout: 30_000 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `higgsfield CLI not ready (install + \`higgsfield auth login\`): ${message.slice(0, 200)}`
    );
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const supabase = createSupabase();

  if (!options.dryRun) await assertHiggsfieldReady();

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
    `card-art: ${votes?.length ?? 0} active votes, ${artable.length} to plate (retry-hours=${options.retryHours}, limit=${options.limit}, model=${options.imageModel})`
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
        model: `higgsfield/${options.imageModel}+claude-scene/v1`,
        attempted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await supabase
        .from('vote_card_art')
        .upsert(attempt, { onConflict: 'vote_id' });

      try {
        const raw = await renderPlate(prompt, options.imageModel);
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
