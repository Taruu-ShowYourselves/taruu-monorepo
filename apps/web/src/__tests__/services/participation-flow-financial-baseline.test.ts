/**
 * ParticipationFlow financial-copy BASELINE (Issue #37, Slice 0).
 *
 * CHARACTERIZATION TESTS — they pin the flow's CURRENT paid presentation
 * (₪3 payment stage, charge receipt, mock seal) so the Slice-2 redesign diff
 * is provable. When Slice 2 lands, the "current paid presentation" describe
 * blocks below are expected to be INVERTED into absence guards; the
 * "survives the redesign" block must keep passing unchanged.
 *
 * Scope note: this covers the participation flow surface only, per Issue #37's
 * UX-only scope. The payment API, the participate endpoint and its contracts
 * are owned by Sahar and are not asserted here.
 *
 * This repo has no component-test setup (vitest runs `environment: 'node'`,
 * @testing-library is not installed), so these assert against the component
 * SOURCE — the same pattern as dashboard-free-mvp.test.ts.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src');
const flow = readFileSync(
  join(SRC, 'app/[locale]/votes/[id]/flow/ParticipationFlow.tsx'),
  'utf8'
);

/** Strip // and block comments so prose about the change is not read as UI. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

const flowCode = code(flow);

describe('BASELINE: the flow currently has a payment stage', () => {
  it('models three stages including payment', () => {
    expect(flowCode).toContain("type Stage = 'choice' | 'payment' | 'receipt'");
  });

  it('shows a three-step stepper with a תשלום step', () => {
    for (const label of ["{ label: 'בחירה' }", "{ label: 'תשלום' }", "{ label: 'אישור' }"]) {
      expect(flowCode).toContain(label);
    }
  });

  it('labels the payment section for assistive tech', () => {
    expect(flowCode).toContain('aria-label="תשלום"');
    expect(flowCode).toContain('שלב 02 · תשלום');
  });
});

describe('BASELINE: the payment stage currently shows the ₪3 fee', () => {
  it('titles the panel with the fee', () => {
    expect(flowCode).toContain('דמי השתתפות · ₪3');
  });

  it('renders a charge receipt with the ₪2/₪1 split', () => {
    expect(flowCode).toContain('kicker="חיוב · CHARGE"');
    expect(flowCode).toContain("{ label: 'לקרן הקהילתית · ה-BAG', value: '₪2' }");
    expect(flowCode).toContain("{ label: 'סה״כ לחיוב', value: '₪3', strong: true }");
  });

  it('repeats the split as a trust line', () => {
    expect(flowCode).toContain('₪2 לקרן הקהילתית · ₪1 לתפעול. הכל מתועד.');
  });

  it('prices every gated CTA variant', () => {
    for (const cta of [
      'המשיכו · תשלום',
      'מעבד תשלום…',
      'התחברו והשלימו · ₪3',
      'אמתו תושבוּת והשלימו · ₪3',
      'שלמו · ₪3',
    ]) {
      expect(flowCode).toContain(cta);
    }
  });

  it('frames the verification gate around payment', () => {
    expect(flowCode).toContain('אימות תושב חד-פעמי לפני התשלום.');
  });
});

describe('BASELINE: the confirmation stage currently reads as a paid receipt', () => {
  it('uses receipt framing with a שולם total', () => {
    expect(flowCode).toContain('kicker="קבלה · RECEIPT"');
    expect(flowCode).toContain("{ label: 'שולם', value: '₪3', strong: true }");
  });
});

describe('BASELINE: the flow currently fabricates success (must NOT survive)', () => {
  // Documented defect: every failure path of handlePay falls into
  // completeWithMockSeal(), showing a sealed "paid" receipt for a vote that
  // was never recorded. Slice 2 removes the fabrication; the real submit
  // wiring is a blocked integration point owned by Sahar.
  it('synthesises a mock blockchain seal', () => {
    expect(flowCode).toContain('function mockHash()');
    expect(flowCode).toContain('completeWithMockSeal');
  });

  it('drives the payment API rather than the participate endpoint', () => {
    expect(flowCode).toContain("fetch('/api/payments/create'");
    expect(flowCode).not.toContain('/participate');
  });
});

describe('survives the redesign: choice stage and round-trip persistence', () => {
  it('keeps the open choice step', () => {
    expect(flowCode).toContain('בחרו את עמדתכם');
    expect(flowCode).toContain('aria-label="בחירת עמדה"');
    expect(flowCode).toContain('הקול שלכם ייחתם בבלוקצ׳יין — בלתי ניתן לשינוי.');
  });

  it('keeps the pending-choice persistence across auth/verify redirects', () => {
    expect(flowCode).toContain("'taruu-pending-vote'");
    expect(flowCode).toContain('persistPending');
  });

  it('keeps the guest gate notice', () => {
    expect(flowCode).toContain('צריך חשבון כדי להשלים — נשמור את הבחירה שלכם ונחזיר אתכם לכאן.');
  });

  it('keeps the seal presentation component', () => {
    expect(flowCode).toContain('SealCard');
  });
});
