/**
 * gi-spike.ts - Green Invoice card-on-file sandbox spike harness.
 *
 * Exercises the full sequence:
 *   1. JWT token exchange  (/account/token)
 *   2. Payment-form card-setup  (/payments/form)  - manual browser step
 *   3. Token charge (MIT)  (/payments/tokens/{id}/charge)  - requires --charge flag + GI_SPIKE_TOKEN_ID
 *
 * Guarded: hard-exits before any network call when Green Invoice credentials are absent.
 * NOT a vitest test - deliberate invocation only, never runs in CI.
 *
 * Usage:
 *   pnpm spike:gi                             # guard + STEP 1 + STEP 2 instructions
 *   GI_SPIKE_TOKEN_ID=<id> pnpm spike:gi --charge  # also runs STEP 3 token charge
 */

import {
  isGreenInvoiceConfigured,
  getToken,
  createPaymentForm,
  chargeToken,
} from '../src/services/greenInvoice/index';

// ===========================================================================
// GUARD FIRST - before any network call
// ===========================================================================
if (!isGreenInvoiceConfigured()) {
  console.error(
    '[gi-spike] SKIPPED: Green Invoice is not configured - set GREENINVOICE_API_KEY_ID / GREENINVOICE_API_SECRET in apps/web/.dev.vars then re-run. No live call attempted.'
  );
  process.exit(1);
}

// ===========================================================================
// Banner
// ===========================================================================
const BASE = 'https://sandbox.d.greeninvoice.co.il/api/v1';
console.log('');
console.log('=== GI Spike Harness ===');
console.log(`Sandbox base : ${BASE}`);
console.log('Sequence     : token → payment-form card-setup → (manual) → token-charge MIT');
console.log('');

async function run(): Promise<void> {
  // -------------------------------------------------------------------------
  // STEP 1 - acquire JWT
  // -------------------------------------------------------------------------
  console.log('[gi-spike] STEP 1: acquiring JWT token…');
  try {
    const token = await getToken();
    console.log('[gi-spike] token acquired (len=' + token.length + ')');
  } catch (err) {
    console.error('[gi-spike] STEP FAILED: ' + String(err));
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // STEP 2 - create payment form for card setup
  // -------------------------------------------------------------------------
  console.log('');
  console.log('[gi-spike] STEP 2: creating payment form for card setup…');

  const stubOrder = {
    id: 'gi-spike-stub-' + Date.now(),
    items: [
      {
        name: 'חברות תַּרְאוּ',
        variantLabel: 'חיוב ראשון',
        quantity: 1,
        unitPriceILS: 6,
      },
    ],
    shippingILS: 0,
    totalILS: 6,
    shipping: {
      fullName: 'Spike Test',
      email: 'spike@taruu.test',
      phone: '',
      street: '',
      city: '',
      zip: '',
      country: 'IL',
    },
  };

  const urls = {
    successUrl: 'https://taruu.co.il/spike/success',
    failureUrl: 'https://taruu.co.il/spike/failure',
    notifyUrl: 'https://taruu.co.il/api/spike/webhook',
  };

  try {
    const formUrl = await createPaymentForm(stubOrder as Parameters<typeof createPaymentForm>[0], urls);
    console.log('[gi-spike] card-setup form URL: ' + formUrl);
    console.log('');
    console.log(
      '[gi-spike] MANUAL STEP: open the form URL, complete card setup, capture the webhook payload,' +
        ' then set GI_SPIKE_TOKEN_ID and re-run with --charge'
    );
    console.log('  Example: GI_SPIKE_TOKEN_ID=<tokenId> pnpm spike:gi --charge');
  } catch (err) {
    console.error('[gi-spike] STEP FAILED: ' + String(err));
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // STEP 3 - token charge MIT (gated on --charge flag + GI_SPIKE_TOKEN_ID env)
  // -------------------------------------------------------------------------
  console.log('');
  const hasChargeFlag = process.argv.includes('--charge');
  const tokenId = process.env.GI_SPIKE_TOKEN_ID;

  if (!hasChargeFlag || !tokenId) {
    console.log('[gi-spike] STEP 3 skipped (token-charge MIT).');
    if (!hasChargeFlag) {
      console.log('  → pass the --charge flag to enable it.');
    }
    if (!tokenId) {
      console.log('  → set GI_SPIKE_TOKEN_ID=<tokenId> from the card-setup webhook payload.');
    }
    console.log('');
    return;
  }

  console.log('[gi-spike] STEP 3: charging saved token (MIT)…');
  try {
    const result = await chargeToken({
      tokenId,
      sum: 6,
      description: 'תַּרְאוּ - חיוב חברות בדיקה',
      client: { name: 'Spike Test' },
      custom: 'gi-spike-' + Date.now(),
    });
    console.log('[gi-spike] token charge result:');
    console.log('  chargeId   : ' + result.chargeId);
    console.log('  documentId : ' + result.documentId);
    console.log('  raw        : ' + JSON.stringify(result.raw));
  } catch (err) {
    console.error('[gi-spike] STEP FAILED: ' + String(err));
    process.exit(1);
  }

  console.log('');
  console.log('[gi-spike] all steps complete - fill SPIKE-RESULT.md with the values above.');
}

run().catch((err) => {
  console.error('[gi-spike] unexpected error: ' + String(err));
  process.exit(1);
});
