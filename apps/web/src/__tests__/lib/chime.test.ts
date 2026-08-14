import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The chime is ornament, and ornament must never be able to throw: not on
 * the server, not in a browser without Web Audio, not with storage sealed
 * off. These tests pin the no-op paths and the suspended-context discipline;
 * the sound itself is untestable in Node and deliberately trivial.
 *
 * The module keeps its AudioContext as a singleton, so every test loads a
 * fresh copy - a context carried over from a previous stub would alias a
 * dead fake.
 */

async function loadChime() {
  vi.resetModules();
  return await import('@/lib/feedback/chime');
}

function stubBrowser({
  audio = true,
  state = 'running',
  resume,
}: {
  audio?: boolean;
  state?: string;
  resume?: () => Promise<void>;
} = {}) {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  };

  class FakeGain {
    gain = {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    };
    connect(node: unknown) {
      return node;
    }
  }
  class FakeOscillator {
    type = 'sine';
    frequency = {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    };
    connect(node: unknown) {
      return node;
    }
    start = vi.fn();
    stop = vi.fn();
  }
  const started: FakeOscillator[] = [];
  class FakeAudioContext {
    state = state;
    currentTime = 0;
    destination = {};
    resume = vi.fn(resume ?? (async () => undefined));
    createGain() {
      return new FakeGain();
    }
    createOscillator() {
      const osc = new FakeOscillator();
      started.push(osc);
      return osc;
    }
  }

  vi.stubGlobal('window', {
    localStorage,
    ...(audio ? { AudioContext: FakeAudioContext } : {}),
  });
  return { store, started };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('chime', () => {
  it('is silent and safe on the server', async () => {
    const { chime, soundEnabled } = await loadChime();
    expect(soundEnabled()).toBe(false);
    expect(() => chime('tick')).not.toThrow();
  });

  it('is safe in a browser without Web Audio', async () => {
    const { chime, soundEnabled } = await loadChime();
    stubBrowser({ audio: false });
    expect(soundEnabled()).toBe(true);
    expect(() => chime('fanfare')).not.toThrow();
  });

  it('honours the mute preference and persists it', async () => {
    const { chime, setSoundEnabled, soundEnabled } = await loadChime();
    const { store, started } = stubBrowser();
    setSoundEnabled(false);
    expect(store.get('taruu:sound')).toBe('off');
    expect(soundEnabled()).toBe(false);
    chime('success');
    expect(started).toHaveLength(0);

    setSoundEnabled(true);
    expect(store.has('taruu:sound')).toBe(false);
    expect(soundEnabled()).toBe(true);
  });

  it('schedules every note of a chime on a running context', async () => {
    const { chime } = await loadChime();
    const { started } = stubBrowser();
    chime('success');
    expect(started).toHaveLength(2);
    for (const osc of started) {
      expect(osc.start).toHaveBeenCalledTimes(1);
      expect(osc.stop).toHaveBeenCalledTimes(1);
    }
  });

  it('plays through a suspended context only once its resume resolves promptly', async () => {
    const { chime } = await loadChime();
    const { started } = stubBrowser({ state: 'suspended' });
    chime('tick');
    /* Nothing scheduled against the frozen clock... */
    expect(started).toHaveLength(0);
    /* ...but the immediate resolve (a fresh context inside a gesture)
       delivers the note. */
    await vi.waitFor(() => expect(started).toHaveLength(1));
  });

  it('drops a chime whose resume never lands, instead of queueing it', async () => {
    const { chime } = await loadChime();
    let rejectResume: (() => void) | undefined;
    const { started } = stubBrowser({
      state: 'suspended',
      resume: () =>
        new Promise<void>((_, reject) => {
          rejectResume = () => reject(new Error('not in a gesture'));
        }),
    });
    chime('tick');
    expect(started).toHaveLength(0);
    rejectResume?.();
    await Promise.resolve();
    expect(started).toHaveLength(0);
  });
});
