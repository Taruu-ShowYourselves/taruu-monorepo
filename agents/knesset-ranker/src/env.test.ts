import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { numberArg } from './env.js';

describe('numberArg', () => {
  it('accepts zero — the case `Number(x) || fallback` swallowed', () => {
    assert.equal(numberArg('0', 24), 0);
  });

  it('accepts ordinary values', () => {
    assert.equal(numberArg('6', 24), 6);
    assert.equal(numberArg('0.5', 24), 0.5);
  });

  it('falls back on missing, non-numeric or negative input', () => {
    assert.equal(numberArg(undefined, 24), 24);
    assert.equal(numberArg('soon', 24), 24);
    assert.equal(numberArg('-3', 24), 24);
    assert.equal(numberArg('Infinity', 24), 24);
  });
});
