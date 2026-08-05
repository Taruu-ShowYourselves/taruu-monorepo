/**
 * Copy tesseract.js worker + core WASM into public/ocr so OCR runs fully
 * self-hosted (no CDN - the document image and models never touch a third
 * party). Traineddata files (heb/eng, tessdata_fast) are committed alongside.
 *
 * Runs automatically before `dev`/`build` (see package.json).
 */
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'public', 'ocr');
mkdirSync(outDir, { recursive: true });

const workerSrc = require.resolve('tesseract.js/dist/worker.min.js');
// pnpm keeps tesseract.js-core unhoisted - resolve it from tesseract.js itself.
const coreDir = dirname(
  require.resolve('tesseract.js-core/package.json', {
    paths: [dirname(require.resolve('tesseract.js/package.json'))],
  })
);

// The worker's browser getCore loads the single-file `*.wasm.js` variants
// (relaxedsimd → simd → plain, lstm-only since we init with OEM.LSTM_ONLY).
const files = [
  [workerSrc, 'worker.min.js'],
  ...[
    'tesseract-core-relaxedsimd-lstm.wasm.js',
    'tesseract-core-simd-lstm.wasm.js',
    'tesseract-core-lstm.wasm.js',
  ].map((f) => [join(coreDir, f), f]),
];

for (const [src, name] of files) {
  if (!existsSync(src)) {
    console.error(`[ocr-assets] missing ${src}`);
    process.exit(1);
  }
  copyFileSync(src, join(outDir, name));
}
console.log(`[ocr-assets] copied ${files.length} files → public/ocr`);

// Face pipeline (selfie match, issue #32): the subset of @vladmandic/human
// models the scan step loads - detector, mesh (gestures), embedding, antispoof.
const faceOut = join(here, '..', 'public', 'models', 'human');
mkdirSync(faceOut, { recursive: true });

const humanModels = join(
  dirname(require.resolve('@vladmandic/human-models/package.json')),
  'models'
);
const faceFiles = ['blazeface', 'facemesh', 'faceres', 'antispoof'].flatMap((m) => [
  `${m}.json`,
  `${m}.bin`,
]);

for (const name of faceFiles) {
  const src = join(humanModels, name);
  if (!existsSync(src)) {
    console.error(`[face-assets] missing ${src}`);
    process.exit(1);
  }
  copyFileSync(src, join(faceOut, name));
}
console.log(`[face-assets] copied ${faceFiles.length} files → public/models/human`);
