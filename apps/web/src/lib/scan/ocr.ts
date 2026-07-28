/**
 * Tesseract.js worker lifecycle — fully self-hosted (public/ocr), so the
 * document image never leaves the device: WASM core, worker script and
 * heb+eng traineddata are all served from our own origin.
 *
 * Two passes per scan:
 *  1. heb+eng full text — names, labels, general layout;
 *  2. digit-whitelist   — numbers and dates without bidi reordering noise
 *     (digits embedded in RTL lines come back scrambled in pass 1).
 */

import { createWorker, OEM, PSM, type Worker } from 'tesseract.js';

let workerPromise: Promise<Worker> | null = null;

function loadWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker(['heb', 'eng'], OEM.LSTM_ONLY, {
      workerPath: '/ocr/worker.min.js',
      corePath: '/ocr',
      langPath: '/ocr',
      gzip: true,
    });
  }
  return workerPromise;
}

/** Warm the worker + models in the background (call on step entry). */
export function preloadOcr(): void {
  void loadWorker().catch(() => {
    // Reset so the actual scan attempt can retry and surface the error.
    workerPromise = null;
  });
}

export interface OcrScan {
  /** Full heb+eng recognition text. */
  text: string;
  /** Digit-only pass text (dates + ID numbers, unscrambled). */
  digitText: string;
  /** Mean word confidence (0-100) of the full pass. */
  confidence: number;
}

export async function recognizeDocument(canvas: HTMLCanvasElement): Promise<OcrScan> {
  const worker = await loadWorker();

  await worker.setParameters({
    tessedit_pageseg_mode: PSM.AUTO,
    tessedit_char_whitelist: '',
  });
  const full = await worker.recognize(canvas);

  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SPARSE_TEXT,
    tessedit_char_whitelist: '0123456789./- ',
  });
  const digits = await worker.recognize(canvas);

  return {
    text: full.data.text ?? '',
    digitText: digits.data.text ?? '',
    confidence: full.data.confidence ?? 0,
  };
}

/** Release the worker (page unmount). */
export async function disposeOcr(): Promise<void> {
  if (!workerPromise) return;
  const pending = workerPromise;
  workerPromise = null;
  try {
    await (await pending).terminate();
  } catch {
    /* already dead — nothing to release */
  }
}
