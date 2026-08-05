/**
 * Client-side image-quality gates for the document scan.
 *
 * Runs on canvas ImageData before OCR: a blurry or glared frame wastes an
 * OCR pass (~seconds) and produces garbage fields, so we fail fast with a
 * fixable Hebrew hint instead.
 */

export interface QualityReport {
  ok: boolean;
  /** Laplacian variance - higher is sharper. */
  blurScore: number;
  /** Fraction of near-blown-out pixels (specular glare). */
  glareRatio: number;
  width: number;
  reasons: ('blurry' | 'glare' | 'too_small')[];
}

/** Tuned on 1280×~807 crops: printed card text needs roughly this sharpness. */
const MIN_BLUR_SCORE = 60;
const MAX_GLARE_RATIO = 0.05;
const MIN_WIDTH_PX = 640;

export function analyzeQuality(image: ImageData): QualityReport {
  const { data, width, height } = image;

  // Grayscale (luma) plane.
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    const o = i * 4;
    gray[i] = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
  }

  // Laplacian variance (3×3 kernel) + glare count in one sweep.
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  let glare = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const lap =
        gray[i - width] + gray[i + width] + gray[i - 1] + gray[i + 1] - 4 * gray[i];
      sum += lap;
      sumSq += lap * lap;
      n += 1;
      if (gray[i] > 250) glare += 1;
    }
  }

  const mean = n > 0 ? sum / n : 0;
  const blurScore = n > 0 ? sumSq / n - mean * mean : 0;
  const glareRatio = n > 0 ? glare / n : 0;

  const reasons: QualityReport['reasons'] = [];
  if (width < MIN_WIDTH_PX) reasons.push('too_small');
  if (blurScore < MIN_BLUR_SCORE) reasons.push('blurry');
  if (glareRatio > MAX_GLARE_RATIO) reasons.push('glare');

  return { ok: reasons.length === 0, blurScore, glareRatio, width, reasons };
}
