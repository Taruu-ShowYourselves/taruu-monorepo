import { describe, expect, it, vi } from 'vitest';
import { sidewaysWheel } from '@/components/press/sections/sidewaysWheel';

/**
 * The desk's two instruments read a sideways wheel as detents: one push, one
 * tile or one station. What has to hold is that a trackpad flick - forty
 * events and a second of momentum after the fingers have gone - is ONE of
 * them, and that pushing again straight away still travels.
 */

const OPTIONS = { stepPx: 55, cooldownMs: 420, quietMs: 160 };

interface FakeWheel {
  deltaX: number;
  deltaY: number;
  shiftKey: boolean;
  timeStamp: number;
  preventDefault: () => void;
  stopPropagation: () => void;
}

const wheel = (
  deltaX: number,
  timeStamp: number,
  { deltaY = 0, shiftKey = false } = {}
): FakeWheel => ({
  deltaX,
  deltaY,
  shiftKey,
  timeStamp,
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
});

const send = (handler: (event: WheelEvent) => void, event: FakeWheel) =>
  handler(event as unknown as WheelEvent);

/** A flick: `count` events of decaying travel, one frame apart, from `at`. */
const flick = (
  handler: (event: WheelEvent) => void,
  { count, delta, at = 0, decay = 0.9, frame = 16 }: {
    count: number;
    delta: number;
    at?: number;
    decay?: number;
    frame?: number;
  }
) => {
  let size = delta;
  for (let i = 0; i < count; i += 1) {
    send(handler, wheel(-size, at + i * frame, { deltaY: 1 }));
    size = Math.max(1, size * decay);
  }
};

describe('sidewaysWheel', () => {
  it('leaves a vertical gesture to the page', () => {
    const onStep = vi.fn();
    const handler = sidewaysWheel({ ...OPTIONS, onStep });
    const event = wheel(2, 0, { deltaY: 120 });

    send(handler, event);

    expect(onStep).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('swallows a sideways gesture so nothing else answers it', () => {
    const handler = sidewaysWheel({ ...OPTIONS, onStep: vi.fn() });
    const event = wheel(-30, 0, { deltaY: 1 });

    send(handler, event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
  });

  it('says nothing until the push is worth a detent', () => {
    const onStep = vi.fn();
    const handler = sidewaysWheel({ ...OPTIONS, onStep });

    send(handler, wheel(-20, 0, { deltaY: 1 }));
    send(handler, wheel(-20, 16, { deltaY: 1 }));
    expect(onStep).not.toHaveBeenCalled();

    send(handler, wheel(-20, 32, { deltaY: 1 }));
    expect(onStep).toHaveBeenCalledTimes(1);
    expect(onStep).toHaveBeenCalledWith(true);
  });

  it('spends a whole trackpad flick on one detent', () => {
    const onStep = vi.fn();
    const handler = sidewaysWheel({ ...OPTIONS, onStep });

    // ~600px of travel across 40 events and 640ms, the shape of one flick
    // plus the momentum the trackpad keeps sending afterwards.
    flick(handler, { count: 40, delta: 34 });

    expect(onStep).toHaveBeenCalledTimes(1);
  });

  it('travels again as soon as the reader pushes again', () => {
    const onStep = vi.fn();
    const handler = sidewaysWheel({ ...OPTIONS, onStep });

    flick(handler, { count: 6, delta: 12, decay: 1, at: 0 });
    flick(handler, { count: 6, delta: 12, decay: 1, at: 700 });
    flick(handler, { count: 6, delta: 12, decay: 1, at: 1400 });

    expect(onStep).toHaveBeenCalledTimes(3);
    expect(onStep.mock.calls.map(([forward]) => forward)).toEqual([
      true,
      true,
      true,
    ]);
  });

  it('turns round without spending what was pushed the other way', () => {
    const onStep = vi.fn();
    const handler = sidewaysWheel({ ...OPTIONS, onStep });

    // Half a push one way, then half a push back: neither is a detent, and
    // the second must not be completed by the first.
    send(handler, wheel(-30, 0, { deltaY: 1 }));
    send(handler, wheel(30, 16, { deltaY: 1 }));
    expect(onStep).not.toHaveBeenCalled();

    send(handler, wheel(30, 32, { deltaY: 1 }));
    expect(onStep).toHaveBeenCalledTimes(1);
    expect(onStep).toHaveBeenCalledWith(false);
  });

  it('starts a gesture from nothing after a pause', () => {
    const onStep = vi.fn();
    const handler = sidewaysWheel({ ...OPTIONS, onStep });

    send(handler, wheel(-40, 0, { deltaY: 1 }));
    // Long enough that this is a new push, not the rest of the last one.
    send(handler, wheel(-40, 1000, { deltaY: 1 }));
    expect(onStep).not.toHaveBeenCalled();

    send(handler, wheel(-40, 1016, { deltaY: 1 }));
    expect(onStep).toHaveBeenCalledTimes(1);
  });

  it('reads shift+wheel as sideways on whichever axis it arrives', () => {
    const onStep = vi.fn();
    const handler = sidewaysWheel({ ...OPTIONS, onStep });

    // Firefox leaves a shifted wheel on deltaY; Chrome moves it to deltaX.
    send(handler, wheel(0, 0, { deltaY: -60, shiftKey: true }));
    expect(onStep).toHaveBeenCalledTimes(1);
    expect(onStep).toHaveBeenCalledWith(true);
  });
});
