/**
 * Node OCR smoke-test for the document-scan pipeline (issue #32).
 *
 * Runs specimen/sample images through the exact production extraction path
 * (tesseract.js heb+eng, digit pass, deriveFields) without a browser.
 *
 * Usage: pnpm exec tsx scripts/ocr-smoke.mts <image> [image...]
 */
import { createWorker, OEM, PSM } from 'tesseract.js';
import { deriveFields, extractDates, extractIdCandidates } from '../src/lib/scan/extract';

const images = process.argv.slice(2);
if (images.length === 0) {
  console.error('usage: tsx scripts/ocr-smoke.mts <image> [image...]');
  process.exit(1);
}

const worker = await createWorker(['heb', 'eng'], OEM.LSTM_ONLY, {
  langPath: new URL('../public/ocr', import.meta.url).pathname,
  gzip: true,
});

for (const path of images) {
  await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, tessedit_char_whitelist: '' });
  const full = await worker.recognize(path);
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, tessedit_char_whitelist: '0123456789./- ' });
  const digits = await worker.recognize(path);

  const text = `${full.data.text}\n${digits.data.text}`;
  console.log(`\n=== ${path} ===`);
  console.log('confidence:', Math.round(full.data.confidence));
  console.log('dates:', extractDates(text));
  console.log('id candidates (checksum-valid):', extractIdCandidates(text));
  console.log('derived (no typed id):', deriveFields(text, ''));
}

await worker.terminate();
