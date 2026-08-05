import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  blendHotness,
  buildEvidence,
  isFresh,
  isIsraeliPress,
  mediaScoreFromOutletCount,
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
  it('maps outlet counts through the editorial table', () => {
    assert.equal(mediaScoreFromOutletCount(0), 0);
    assert.equal(mediaScoreFromOutletCount(1), 35);
    assert.equal(mediaScoreFromOutletCount(3), 68);
    assert.equal(mediaScoreFromOutletCount(50), 100);
  });

  it('blends hotness 60/40', () => {
    assert.equal(blendHotness(100, 0), 60);
    assert.equal(blendHotness(0, 100), 40);
    assert.equal(blendHotness(80, 55), 70);
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

    assert.equal(evidence.outletsCounted, 2); // ynet + globes
    assert.equal(evidence.hits.length, 6);
    assert.deepEqual(evidence.queries, ['שאילתה 1']);
    assert.equal(evidence.checkedAt, NOW.toISOString());

    const by = (u: string) => evidence.hits.find((h) => h.url === u)!;
    assert.equal(by('https://www.mako.co.il/c').fresh, false);
    assert.equal(by('https://www.calcalist.co.il/d').ok, false);
    assert.equal(by('https://www.nytimes.com/e').israeliPress, false);
    assert.equal(by('https://www.globes.co.il/f').counted, true);
  });

  it('zeroes the outlet count when every ref is dead', async () => {
    const evidence = await buildEvidence(
      [],
      [{ url: 'https://www.ynet.co.il/gone', publishedAt: '2026-07-25' }],
      NOW,
      fetchWith({ 'https://www.ynet.co.il/gone': 404 })
    );
    assert.equal(evidence.outletsCounted, 0);
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
