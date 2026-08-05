import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildPlatePrompt, findImageUrl, parseScenes } from './art.js';

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
