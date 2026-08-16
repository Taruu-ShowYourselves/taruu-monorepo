import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildPlatePrompt,
  findImageUrl,
  parseScenes,
  selectCandidates,
} from './art.js';

const batch = [
  { id: 'v1', title: 'שבילי אופניים', description: 'הפרדה פיזית' },
  { id: 'v2', title: 'גני משחקים', description: 'תאורה עד 22:00' },
];

describe('parseScenes', () => {
  it('reads a fenced JSON array and keys scenes by voteId', () => {
    const raw = [
      '```json',
      '[{"voteId":"v1","scene":"a protected bicycle lane divided by concrete planters"},',
      ' {"voteId":"v2","scene":"a playground at dusk lit by tall street lamps"}]',
      '```',
    ].join('\n');
    const scenes = parseScenes(raw, batch);
    assert.equal(scenes.size, 2);
    assert.match(scenes.get('v1') ?? '', /bicycle lane/);
  });

  it('drops unknown ids, empty and over-long scenes', () => {
    const raw = JSON.stringify([
      { voteId: 'v1', scene: '' },
      { voteId: 'v2', scene: 'x'.repeat(301) },
      { voteId: 'nope', scene: 'a perfectly fine scene about a city street' },
    ]);
    assert.equal(parseScenes(raw, batch).size, 0);
  });

  it('surfaces non-JSON agent output as an error', () => {
    assert.throws(
      () => parseScenes('Not logged in', batch),
      /no JSON array/
    );
  });
});

describe('selectCandidates', () => {
  const KNESSET = 'כנסת ישראל';
  const cv = (id: string, municipalityId: string, hotness: number) => ({
    id,
    title: id,
    description: '',
    municipalityId,
    hotness,
  });

  it('keeps every Knesset item and only the municipal top-N', () => {
    const picked = selectCandidates(
      [
        cv('k1', KNESSET, 0),
        cv('k2', KNESSET, 0),
        cv('a1', 'עכו', 80),
        cv('a2', 'עכו', 50),
        cv('a3', 'עכו', 90),
        cv('b1', 'לוד', 10),
      ],
      2
    );
    const ids = picked.map((v) => v.id);
    assert.deepEqual(new Set(ids), new Set(['k1', 'k2', 'a3', 'a1', 'b1']));
    assert.ok(!ids.includes('a2'));
  });

  it('queues municipal plates before Knesset ones, hottest first', () => {
    const ids = selectCandidates(
      [cv('k1', KNESSET, 0), cv('b1', 'לוד', 10), cv('a1', 'עכו', 80)],
      2
    ).map((v) => v.id);
    assert.deepEqual(ids, ['a1', 'b1', 'k1']);
  });
});

describe('findImageUrl', () => {
  it('finds a nested result url in a job payload', () => {
    const payload = {
      id: 'job-1',
      status: 'completed',
      results: [{ raw_url: 'https://cdn.higgsfield.ai/x/plate.png' }],
    };
    assert.equal(
      findImageUrl(payload),
      'https://cdn.higgsfield.ai/x/plate.png'
    );
  });

  it('prefers conventional keys and ignores non-image strings', () => {
    const payload = {
      note: 'https://higgsfield.ai/jobs/123',
      url: 'https://cdn.higgsfield.ai/y.webp?sig=1',
    };
    assert.equal(findImageUrl(payload), 'https://cdn.higgsfield.ai/y.webp?sig=1');
  });

  it('returns null when nothing matches', () => {
    assert.equal(findImageUrl({ status: 'queued', id: 'abc' }), null);
  });
});

describe('buildPlatePrompt', () => {
  it('wraps the scene in the house style and forbids typography', () => {
    const prompt = buildPlatePrompt('a bus stop under rain');
    assert.match(prompt, /^Two-color risograph screenprint/);
    assert.match(prompt, /a bus stop under rain\./);
    assert.match(prompt, /All surfaces blank — no text, no letters/);
  });

  it('does not double the closing full stop', () => {
    assert.doesNotMatch(buildPlatePrompt('a city square.'), /\.\./);
  });
});
