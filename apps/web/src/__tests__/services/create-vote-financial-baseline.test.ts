/**
 * Create-vote wizard financial-copy BASELINE (Issue #37, Slice 0).
 *
 * CHARACTERIZATION TESTS — they pin the wizard's CURRENT paid presentation
 * (4th תשלום step, ₪50 creation fee, Paddle framing) so the Slice-2 redesign
 * diff is provable. When Slice 2 lands, the "current paid presentation"
 * blocks are expected to be INVERTED into absence guards; the "survives the
 * redesign" block must keep passing unchanged.
 *
 * Scope note: UX surface only. The creation endpoint (currently reached via
 * /payments/return), its paymentTxId contract and any anti-spam replacement
 * for the fee are owned by Sahar and are not asserted here.
 *
 * Source-string tests (node env, no component rendering available) — same
 * pattern as dashboard-free-mvp.test.ts.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src');
const page = readFileSync(join(SRC, 'app/[locale]/votes/create/page.tsx'), 'utf8');

/** Strip // and block comments so prose about the change is not read as UI. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

const pageCode = code(page);

describe('BASELINE: the wizard currently ends in a payment step', () => {
  it('has four steps, the last labelled תשלום', () => {
    for (const label of [
      "{ label: 'נושא' }",
      "{ label: 'אפשרויות' }",
      "{ label: 'משך' }",
      "{ label: 'תשלום' }",
    ]) {
      expect(pageCode).toContain(label);
    }
  });

  it('presents the payment plate', () => {
    expect(pageCode).toContain('FIG. 4 · תשלום');
    expect(pageCode).toContain('kicker="קבלה · CREATE FEE"');
  });
});

describe('BASELINE: the wizard currently shows the ₪50 creation fee', () => {
  it('imports the shared price constants', () => {
    expect(pageCode).toContain("import { CREATE_VOTE_COST, formatCurrency } from '@sync/shared'");
  });

  it('itemises the creation fee', () => {
    expect(pageCode).toContain("label: 'דמי יצירת הצבעה'");
    expect(pageCode).toContain('value: formatCurrency(CREATE_VOTE_COST)');
    expect(pageCode).toContain("{ label: 'דמי יצירה', value: formatCurrency(CREATE_VOTE_COST), strong: true }");
  });

  it('prices the submit CTA', () => {
    expect(pageCode).toContain('צרו הצבעה · ${formatCurrency(CREATE_VOTE_COST)}');
    expect(pageCode).toContain('מעבד תשלום…');
  });

  it('names the payment provider in visible copy', () => {
    expect(pageCode).toContain('footer="תשלום מאובטח · Paddle · חתום בבלוקצ׳יין"');
  });
});

describe('BASELINE: submission currently routes through the payment API', () => {
  // The draft is stashed in sessionStorage and the vote is actually created
  // on the Paddle return leg (/payments/return) — the app's only real
  // POST /api/votes. Relocating it is Sahar's; the UI must not fabricate a
  // created vote in the meantime.
  it('creates a payment session, not a vote', () => {
    expect(pageCode).toContain("fetch('/api/payments/create'");
    expect(pageCode).not.toContain("fetch('/api/votes'");
  });

  it('stashes the draft for the payment return leg', () => {
    expect(pageCode).toContain("sessionStorage.setItem('pendingVote'");
  });
});

describe('survives the redesign: the editorial wizard itself', () => {
  it('keeps the topic, options and duration steps', () => {
    expect(pageCode).toContain("{ label: 'נושא' }");
    expect(pageCode).toContain("{ label: 'אפשרויות' }");
    expect(pageCode).toContain("{ label: 'משך' }");
  });

  it('keeps the duration choices', () => {
    for (const label of ['3 ימים', '7 ימים', '14 יום', '30 יום']) {
      expect(pageCode).toContain(label);
    }
  });

  it('derives the stepper from the label list (count-agnostic)', () => {
    expect(pageCode).toContain('const STEP_COUNT = STEP_LABELS.length');
  });
});
