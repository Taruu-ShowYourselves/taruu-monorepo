import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cleanHeadline, isFatalAgentFailure, parseFindings } from './rank.js';

const BATCH = [
  { id: 'aaaa', title: 'חוק א', itemType: 'הצעת חוק', summary: null },
  { id: 'bbbb', title: 'חוק ב', itemType: null, summary: 'תקציר' },
];

describe('parseFindings', () => {
  it('parses a clean payload with queries and coverage', () => {
    const raw = JSON.stringify([
      {
        voteId: 'aaaa',
        relevance: 87,
        rationale: 'נושא בוער',
        queries: ['חוק א חדשות'],
        coverage: [
          { url: 'https://www.ynet.co.il/x', publishedAt: '2026-07-25' },
          { url: 'https://www.mako.co.il/y', publishedAt: null },
        ],
      },
    ]);
    const findings = parseFindings(raw, BATCH);
    assert.equal(findings.length, 1);
    assert.equal(findings[0]!.relevance, 87);
    assert.deepEqual(findings[0]!.queries, ['חוק א חדשות']);
    assert.equal(findings[0]!.coverage.length, 2);
    assert.equal(findings[0]!.coverage[0]!.publishedAt, '2026-07-25');
    assert.equal(findings[0]!.coverage[1]!.publishedAt, null);
  });

  it('strips code fences, drops unknown voteIds and non-http urls, clamps', () => {
    const raw = [
      '```json',
      JSON.stringify([
        {
          voteId: 'bbbb',
          relevance: 250,
          rationale: 'r',
          queries: ['', '  q  '],
          coverage: [
            { url: 'ftp://bad', publishedAt: '2026-07-20' },
            { url: 'https://ok.co.il/a', publishedAt: 'לא תאריך' },
          ],
        },
        { voteId: 'not-in-batch', relevance: 10, rationale: 'x' },
      ]),
      '```',
    ].join('\n');
    const findings = parseFindings(raw, BATCH);
    assert.equal(findings.length, 1);
    assert.equal(findings[0]!.voteId, 'bbbb');
    assert.equal(findings[0]!.relevance, 100);
    assert.deepEqual(findings[0]!.queries, ['q']);
    assert.deepEqual(findings[0]!.coverage, [
      { url: 'https://ok.co.il/a', publishedAt: null },
    ]);
  });

  it('surfaces non-JSON agent output (e.g. login errors)', () => {
    assert.throws(
      () => parseFindings('Not logged in', BATCH),
      /no JSON array in agent output/
    );
  });
});

describe('isFatalAgentFailure', () => {
  it('treats account-level failures as fatal', () => {
    assert.ok(
      isFatalAgentFailure(
        "no JSON array in agent output: \"You've hit your monthly spend limit. Run /usage-credits\""
      )
    );
    assert.ok(isFatalAgentFailure('Not logged in'));
    assert.ok(isFatalAgentFailure('Your credit balance is too low'));
    assert.ok(isFatalAgentFailure('rate limit exceeded'));
  });

  it('treats batch-local failures as recoverable', () => {
    assert.equal(isFatalAgentFailure('Unexpected token < in JSON at position 0'), false);
    assert.equal(isFatalAgentFailure('agent stream ended without a result message'), false);
    assert.equal(isFatalAgentFailure('agent output is not an array'), false);
  });
});

describe('cleanHeadline', () => {
  it('keeps a headline the desk can set', () => {
    assert.equal(
      cleanHeadline('הארכת הוראת השעה לגיוס חובה'),
      'הארכת הוראת השעה לגיוס חובה'
    );
  });

  it('strips wrapping quotes, a trailing stop and stray whitespace', () => {
    assert.equal(cleanHeadline('  "ביטול פטור המע"מ  לדירה ראשונה."  '), 'ביטול פטור המע"מ לדירה ראשונה');
    assert.equal(cleanHeadline('הרחבת חוק חינוך חינם\u05c3'), 'הרחבת חוק חינוך חינם');
  });

  /** A cut-off headline reads worse than the citation the app falls back to. */
  it('drops an over-long headline rather than truncating it', () => {
    assert.equal(cleanHeadline('א'.repeat(91)), '');
    assert.equal(cleanHeadline('א'.repeat(90)).length, 90);
  });

  it('drops empty and non-string values', () => {
    for (const value of ['', '   ', null, undefined, 42, {}]) {
      assert.equal(cleanHeadline(value), '');
    }
  });
});
