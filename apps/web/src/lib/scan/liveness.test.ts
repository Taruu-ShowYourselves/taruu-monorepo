import { describe, expect, it } from 'vitest';
import {
  advanceLiveness,
  buildChallengeSequence,
  challengePrompt,
  initialLiveness,
  type Observation,
} from './liveness';

const face = (over: Partial<Observation> = {}): Observation => ({
  facePresent: true,
  blink: false,
  facing: 'center',
  ...over,
});

describe('buildChallengeSequence', () => {
  it('always contains exactly one blink and one turn', () => {
    for (const r of [0.1, 0.4, 0.6, 0.9]) {
      const seq = buildChallengeSequence(() => r);
      expect(seq).toHaveLength(2);
      expect(seq.filter((c) => c === 'blink')).toHaveLength(1);
      expect(seq.some((c) => c === 'turn_left' || c === 'turn_right')).toBe(true);
    }
  });

  it('randomizes order and direction via the injected rand', () => {
    expect(buildChallengeSequence(() => 0.1)).toEqual(['blink', 'turn_left']);
    expect(buildChallengeSequence(() => 0.9)).toEqual(['turn_right', 'blink']);
  });
});

describe('advanceLiveness', () => {
  it('passes only after every challenge is satisfied in order', () => {
    let state = initialLiveness(['blink', 'turn_left']);
    // A turn before the blink must not advance anything.
    state = advanceLiveness(state, face({ facing: 'left' }));
    expect(state.index).toBe(0);

    state = advanceLiveness(state, face({ blink: true }));
    expect(state.index).toBe(1);
    expect(state.passed).toBe(false);

    state = advanceLiveness(state, face({ facing: 'right' }));
    expect(state.passed).toBe(false);

    state = advanceLiveness(state, face({ facing: 'left' }));
    expect(state.passed).toBe(true);
  });

  it('counts consecutive missing-face frames and resets on return', () => {
    let state = initialLiveness(['blink']);
    state = advanceLiveness(state, face({ facePresent: false }));
    state = advanceLiveness(state, face({ facePresent: false }));
    expect(state.missingFrames).toBe(2);
    state = advanceLiveness(state, face());
    expect(state.missingFrames).toBe(0);
  });

  it('is inert once passed', () => {
    let state = initialLiveness(['blink']);
    state = advanceLiveness(state, face({ blink: true }));
    expect(state.passed).toBe(true);
    const after = advanceLiveness(state, face({ facePresent: false }));
    expect(after).toEqual(state);
  });
});

describe('challengePrompt', () => {
  it('maps the current challenge to a Hebrew prompt', () => {
    const state = initialLiveness(['turn_right', 'blink']);
    expect(challengePrompt(state)).toBe('סובבו את הראש ימינה');
    const done = advanceLiveness(
      advanceLiveness(state, face({ facing: 'right' })),
      face({ blink: true })
    );
    expect(challengePrompt(done)).toBe('מצוין - זוהיתם');
  });
});
