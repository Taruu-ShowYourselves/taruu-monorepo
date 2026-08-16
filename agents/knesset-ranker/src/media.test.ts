import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  UNDATED_WEIGHT,
  blendHotness,
  buildEvidence,
  freshnessWeight,
  isFresh,
  isIsraeliPress,
  mediaScoreFromOutlets,
  probeUrl,
  refsForDisplay,
  registrableDomain,
  type FetchLike,
} from './media.js';

const NOW = new Date('2026-07-29T12:00:00Z');

const fetchWith =
  (statusByUrl: Record<string, number | 'error'>): FetchLike =>
  async (url) => {
    const status = statusByUrl[url];
    if (status === undefined) throw new Error(`unexpected probe: ${url}`);
    if (status === 'error') throw new Error('network down');
    return { status };
  };

describe('registrableDomain', () => {
  it('collapses subdomains against Israeli two-label suffixes', () => {
    assert.equal(registrableDomain('https://www.ynet.co.il/news/x'), 'ynet.co.il');
    assert.equal(registrableDomain('https://news.walla.co.il/item/1'), 'walla.co.il');
    assert.equal(registrableDomain('https://www.kan.org.il/item/2'), 'kan.org.il');
    assert.equal(registrableDomain('https://main.knesset.gov.il/x'), 'knesset.gov.il');
  });

  it('uses eTLD+1 for ordinary TLDs and rejects garbage', () => {
    assert.equal(registrableDomain('https://www.themarker.com/law/1'), 'themarker.com');
    assert.equal(registrableDomain('not a url'), null);
  });
});

describe('isIsraeliPress', () => {
  it('accepts .il press and known Israeli outlets on foreign TLDs', () => {
    assert.ok(isIsraeliPress('https://www.ynet.co.il/news/article/1'));
    assert.ok(isIsraeliPress('https://www.kan.org.il/content/2'));
    assert.ok(isIsraeliPress('https://www.themarker.com/news/3'));
    assert.ok(isIsraeliPress('https://www.timesofisrael.com/x/'));
  });

  it('rejects institutions, platforms and foreign press', () => {
    assert.equal(isIsraeliPress('https://main.knesset.gov.il/x'), false);
    assert.equal(isIsraeliPress('https://www.gov.il/he/x'), false);
    assert.equal(isIsraeliPress('https://www.tau.ac.il/x'), false);
    assert.equal(isIsraeliPress('https://www.facebook.com/groups/1'), false);
    assert.equal(isIsraeliPress('https://he.wikipedia.org/wiki/x'), false);
    assert.equal(isIsraeliPress('https://www.nytimes.com/x'), false);
  });
});

describe('isFresh', () => {
  it('accepts within the window, rejects older, tolerates unknown', () => {
    assert.ok(isFresh('2026-07-20', NOW));
    assert.equal(isFresh('2026-07-01', NOW), false);
    assert.ok(isFresh(null, NOW));
    assert.ok(isFresh('garbage-date', NOW));
  });
});

describe('scoring', () => {
  it('maps whole effective-outlet counts through the editorial table', () => {
    assert.equal(mediaScoreFromOutlets(0), 0);
    assert.equal(mediaScoreFromOutlets(1), 35);
    assert.equal(mediaScoreFromOutlets(3), 68);
    assert.equal(mediaScoreFromOutlets(50), 100);
  });

  it('interpolates between table anchors for fractional counts', () => {
    assert.equal(mediaScoreFromOutlets(0.5), 18); // halfway 0→35
    assert.equal(mediaScoreFromOutlets(1.5), 45); // halfway 35→55
    assert.equal(mediaScoreFromOutlets(2.4), 60); // 55 + 0.4·13, rounded
  });

  it('decays freshness with a 4-day half-life, discounts undated hits', () => {
    assert.ok(freshnessWeight('2026-07-29', NOW) > 0.9); // published today
    assert.ok(Math.abs(freshnessWeight('2026-07-25', NOW) - 0.5) < 0.06); // ~4d → ~half
    assert.ok(freshnessWeight('2026-07-16', NOW) < 0.15); // ~13d → embers
    assert.equal(freshnessWeight(null, NOW), UNDATED_WEIGHT);
    assert.equal(freshnessWeight('garbage-date', NOW), UNDATED_WEIGHT);
  });

  it('blends hotness media 45 / stakes 35 / relevance 20', () => {
    assert.equal(blendHotness({ relevance: 100, stakes: 100, media: 100 }), 100);
    assert.equal(blendHotness({ relevance: 100, stakes: 0, media: 0 }), 20);
    assert.equal(blendHotness({ relevance: 0, stakes: 100, media: 0 }), 35);
    assert.equal(blendHotness({ relevance: 0, stakes: 0, media: 100 }), 45);
  });

  it('falls back to relevance when the stakes axis is missing', () => {
    assert.equal(
      blendHotness({ relevance: 80, stakes: null, media: 50 }),
      Math.round(0.45 * 50 + 0.35 * 80 + 0.2 * 80)
    );
  });

  /**
   * The regression that motivated v3: a ceremonial item drowning in general
   * topic coverage must rank under a binding bill with real, current press.
   */
  it('ranks a low-stakes saturated item under a high-stakes covered bill', () => {
    const memorial = blendHotness({ relevance: 90, stakes: 10, media: 55 });
    const conscription = blendHotness({ relevance: 85, stakes: 90, media: 78 });
    assert.ok(conscription > memorial);
  });
});

describe('probeUrl', () => {
  it('marks 404/410 and network failures dead, keeps 403 alive via GET retry', async () => {
    assert.deepEqual(
      await probeUrl('https://a.co.il/x', fetchWith({ 'https://a.co.il/x': 404 })),
      { status: 404, ok: false }
    );
    assert.deepEqual(
      await probeUrl('https://b.co.il/x', fetchWith({ 'https://b.co.il/x': 'error' })),
      { status: null, ok: false }
    );
    assert.deepEqual(
      await probeUrl('https://c.co.il/x', fetchWith({ 'https://c.co.il/x': 403 })),
      { status: 403, ok: true }
    );
    assert.deepEqual(
      await probeUrl('https://d.co.il/x', fetchWith({ 'https://d.co.il/x': 200 })),
      { status: 200, ok: true }
    );
  });
});

describe('buildEvidence', () => {
  it('counts each outlet once, only alive+fresh+Israeli hits', async () => {
    const claims = [
      { url: 'https://www.ynet.co.il/a', publishedAt: '2026-07-25' },
      { url: 'https://www.ynet.co.il/b', publishedAt: '2026-07-26' }, // same outlet
      { url: 'https://www.mako.co.il/c', publishedAt: '2026-07-01' }, // stale
      { url: 'https://www.calcalist.co.il/d', publishedAt: null }, // dead
      { url: 'https://www.nytimes.com/e', publishedAt: '2026-07-27' }, // foreign
      { url: 'https://www.globes.co.il/f', publishedAt: null }, // undated, alive
    ];
    const evidence = await buildEvidence(
      ['שאילתה 1'],
      claims,
      NOW,
      fetchWith({
        'https://www.ynet.co.il/a': 200,
        'https://www.ynet.co.il/b': 200,
        'https://www.mako.co.il/c': 200,
        'https://www.calcalist.co.il/d': 404,
        'https://www.nytimes.com/e': 200,
        'https://www.globes.co.il/f': 200,
      })
    );

    assert.equal(evidence.version, 3);
    assert.equal(evidence.outletsCounted, 2); // ynet + globes
    assert.equal(evidence.hits.length, 6);
    assert.deepEqual(evidence.queries, ['שאילתה 1']);
    assert.equal(evidence.checkedAt, NOW.toISOString());

    const by = (u: string) => evidence.hits.find((h) => h.url === u)!;
    assert.equal(by('https://www.mako.co.il/c').fresh, false);
    assert.equal(by('https://www.calcalist.co.il/d').ok, false);
    assert.equal(by('https://www.nytimes.com/e').israeliPress, false);
    assert.equal(by('https://www.globes.co.il/f').counted, true);

    // Uncounted hits carry no weight; the effective total is ynet's best
    // (freshest) hit plus globes' undated discount — not one per article.
    assert.equal(by('https://www.mako.co.il/c').weight, 0);
    const ynetBest = by('https://www.ynet.co.il/b').weight;
    assert.ok(ynetBest > by('https://www.ynet.co.il/a').weight);
    assert.equal(
      evidence.effectiveOutlets,
      Math.round((ynetBest + UNDATED_WEIGHT) * 100) / 100
    );
  });

  it('zeroes the outlet count when every ref is dead', async () => {
    const evidence = await buildEvidence(
      [],
      [{ url: 'https://www.ynet.co.il/gone', publishedAt: '2026-07-25' }],
      NOW,
      fetchWith({ 'https://www.ynet.co.il/gone': 404 })
    );
    assert.equal(evidence.outletsCounted, 0);
    assert.equal(evidence.effectiveOutlets, 0);
  });

  it('dedupes claim URLs before probing', async () => {
    let probes = 0;
    const countingFetch: FetchLike = async () => {
      probes += 1;
      return { status: 200 };
    };
    const evidence = await buildEvidence(
      [],
      [
        { url: 'https://www.ynet.co.il/a', publishedAt: null },
        { url: 'https://www.ynet.co.il/a', publishedAt: null },
      ],
      NOW,
      countingFetch
    );
    assert.equal(probes, 1);
    assert.equal(evidence.hits.length, 1);
  });
});

describe('refsForDisplay', () => {
  it('returns one counted ref per outlet, in hit order', async () => {
    const evidence = await buildEvidence(
      [],
      [
        { url: 'https://www.ynet.co.il/a', publishedAt: null },
        { url: 'https://www.ynet.co.il/b', publishedAt: null },
        { url: 'https://www.globes.co.il/c', publishedAt: null },
        { url: 'https://www.haaretz.co.il/d', publishedAt: '2026-06-01' }, // stale → excluded
      ],
      NOW,
      fetchWith({
        'https://www.ynet.co.il/a': 200,
        'https://www.ynet.co.il/b': 200,
        'https://www.globes.co.il/c': 200,
        'https://www.haaretz.co.il/d': 200,
      })
    );
    assert.deepEqual(refsForDisplay(evidence), [
      'https://www.ynet.co.il/a',
      'https://www.globes.co.il/c',
    ]);
  });
});
