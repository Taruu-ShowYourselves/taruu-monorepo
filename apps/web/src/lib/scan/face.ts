/**
 * Face pipeline (selfie match, issue #32) - @vladmandic/human, fully
 * self-hosted (/models/human): detection, mesh gestures (active liveness),
 * faceres embedding (match) and antispoof - all on-device.
 *
 * Nothing biometric leaves the browser: embeddings and frames stay in
 * memory; only derived scores are ever submitted.
 */

import type { Observation } from './liveness';

// Human is ~1.5MB + tfjs - loaded only when the selfie phase starts.
type HumanModule = typeof import('@vladmandic/human');
type HumanInstance = InstanceType<HumanModule['Human']>;

let humanPromise: Promise<{ human: HumanInstance; mod: HumanModule }> | null = null;

function loadHuman(): Promise<{ human: HumanInstance; mod: HumanModule }> {
  const existing = humanPromise;
  if (existing) return existing;

  const attempt = (async () => {
      // next.config aliases this specifier to the browser ESM bundle - the
      // package's own `node` export condition would break Next's SSR compile.
      const mod = await import('@vladmandic/human');
      const human = new mod.Human({
        modelBasePath: '/models/human',
        cacheSensitivity: 0,
        filter: { enabled: true, equalization: false },
        face: {
          enabled: true,
          detector: { rotation: false, maxDetected: 1, modelPath: 'blazeface.json' },
          mesh: { enabled: true, modelPath: 'facemesh.json' },
          iris: { enabled: false },
          description: { enabled: true, modelPath: 'faceres.json' },
          emotion: { enabled: false },
          antispoof: { enabled: true, modelPath: 'antispoof.json' },
        },
        body: { enabled: false },
        hand: { enabled: false },
        object: { enabled: false },
        segmentation: { enabled: false },
        gesture: { enabled: true },
      });
      await human.load();
      await human.warmup();
      return { human, mod };
  })();
  attempt.catch(() => {
    if (humanPromise === attempt) humanPromise = null; // let a retry start clean
  });
  humanPromise = attempt;
  return attempt;
}

/** Warm models in the background (call when the capture phase starts). */
export function preloadFace(): void {
  void loadHuman().catch(() => undefined);
}

export interface FaceReading {
  /** faceres descriptor - kept in memory only, never submitted. */
  embedding: number[] | null;
  /** Antispoof "real" score 0-1 (null when the model gave none). */
  real: number | null;
  faceFound: boolean;
}

/** Detect the (single) face in a still frame and read its embedding. */
export async function readFace(
  input: HTMLCanvasElement | HTMLVideoElement
): Promise<FaceReading> {
  const { human } = await loadHuman();
  const result = await human.detect(input);
  const face = result.face[0];
  if (!face) return { embedding: null, real: null, faceFound: false };
  return {
    embedding: face.embedding && face.embedding.length > 0 ? face.embedding : null,
    real: typeof face.real === 'number' ? face.real : null,
    faceFound: true,
  };
}

/**
 * The selfie preview is CSS-mirrored (standard selfie UX), so users follow
 * prompts relative to their mirror image while human.js sees the unmirrored
 * frame - swap left/right when reporting facing.
 */
const MIRRORED_PREVIEW = true;

/** One liveness observation from the live video (drives the challenge machine). */
export async function observeFrame(video: HTMLVideoElement): Promise<Observation> {
  const { human } = await loadHuman();
  const result = await human.detect(video);
  const face = result.face[0];
  if (!face) return { facePresent: false, blink: false, facing: 'unknown' };

  const gestures = result.gesture.map((g) => g.gesture as string);
  const blink = gestures.some((g) => g.startsWith('blink'));

  let facing: Observation['facing'] = 'unknown';
  if (gestures.includes('facing center')) facing = 'center';
  else if (gestures.includes('facing left')) facing = MIRRORED_PREVIEW ? 'right' : 'left';
  else if (gestures.includes('facing right')) facing = MIRRORED_PREVIEW ? 'left' : 'right';

  return { facePresent: true, blink, facing };
}

/** Normalized similarity 0-1 between two faceres descriptors (≥0.5 ≈ match). */
export async function faceSimilarity(a: number[], b: number[]): Promise<number> {
  const { mod } = await loadHuman();
  return mod.match.similarity(a, b);
}

/** Release models + tensors (page unmount). */
export async function disposeFace(): Promise<void> {
  if (!humanPromise) return;
  const pending = humanPromise;
  humanPromise = null;
  try {
    // Frees tfjs tensors/webgl textures; sufficient teardown between visits.
    (await pending).human.reset();
  } catch {
    /* already gone */
  }
}
