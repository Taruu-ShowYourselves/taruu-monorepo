/**
 * Active-liveness challenge machine — pure logic, no camera, no human.js.
 *
 * The selfie step issues a short randomized challenge sequence (a blink plus
 * a head turn) and advances only when the live gesture stream satisfies the
 * current challenge. Pure + deterministic so it unit-tests in node; the
 * component feeds it observations mapped from human.js gestures.
 */

export type Challenge = 'blink' | 'turn_left' | 'turn_right';

export interface Observation {
  facePresent: boolean;
  blink: boolean;
  facing: 'left' | 'center' | 'right' | 'unknown';
}

export interface LivenessState {
  sequence: Challenge[];
  /** Index of the current (unsatisfied) challenge. */
  index: number;
  /** Consecutive frames without a face — used to abort, not to reset. */
  missingFrames: number;
  passed: boolean;
}

/** Frames without a face after which the caller should restart the step. */
export const MAX_MISSING_FRAMES = 25;

/**
 * Build the randomized sequence: one blink and one head turn, in random
 * order and direction. `rand` is injected for testability.
 */
export function buildChallengeSequence(rand: () => number = Math.random): Challenge[] {
  const turn: Challenge = rand() < 0.5 ? 'turn_left' : 'turn_right';
  return rand() < 0.5 ? ['blink', turn] : [turn, 'blink'];
}

export function initialLiveness(sequence: Challenge[]): LivenessState {
  return { sequence, index: 0, missingFrames: 0, passed: sequence.length === 0 };
}

function satisfies(challenge: Challenge, obs: Observation): boolean {
  switch (challenge) {
    case 'blink':
      return obs.blink;
    case 'turn_left':
      return obs.facing === 'left';
    case 'turn_right':
      return obs.facing === 'right';
  }
}

/** Advance the machine with one observation frame. */
export function advanceLiveness(state: LivenessState, obs: Observation): LivenessState {
  if (state.passed) return state;

  if (!obs.facePresent) {
    return { ...state, missingFrames: state.missingFrames + 1 };
  }

  const current = state.sequence[state.index];
  if (current !== undefined && satisfies(current, obs)) {
    const index = state.index + 1;
    return {
      ...state,
      index,
      missingFrames: 0,
      passed: index >= state.sequence.length,
    };
  }

  return { ...state, missingFrames: 0 };
}

/** Hebrew prompt for the current challenge (mirrored for the front camera). */
export function challengePrompt(state: LivenessState): string {
  if (state.passed) return 'מצוין — זוהיתם';
  switch (state.sequence[state.index]) {
    case 'blink':
      return 'מצמצו פעם אחת';
    case 'turn_left':
      return 'סובבו את הראש שמאלה';
    case 'turn_right':
      return 'סובבו את הראש ימינה';
    default:
      return 'הביטו למצלמה';
  }
}
