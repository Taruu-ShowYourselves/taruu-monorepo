/**
 * Chime - the site's voice for a moment that went well.
 *
 * Everything is synthesised on a lazy AudioContext: no audio files, nothing
 * fetched, a few hundred bytes of oscillator schedules. Every call site is a
 * user gesture (a tap, a completed hold, a step submitted), which is exactly
 * the window autoplay policy allows a context to start in - so the first
 * chime is also the moment the context is created.
 *
 * The vocabulary is deliberately tiny:
 *   tick     - a control acknowledged (tab flipped, town dialled, step taken)
 *   pop      - a small gift sent (a share, a code accepted)
 *   success  - a ballot cast: the two-note "it counted"
 *   fanfare  - an account verified: the one arpeggio the site ever plays
 *
 * Muting persists per browser. There is no volume knob - the sounds live at
 * ornament level or they do not live at all.
 */

export type ChimeKind = 'tick' | 'pop' | 'success' | 'fanfare';

const STORAGE_KEY = 'taruu:sound';

/** One note in a schedule: when (s), pitch (Hz), length (s), peak gain. */
interface Note {
  at: number;
  hz: number;
  dur: number;
  peak: number;
  /** Oscillator voice; triangle reads soft, sine reads round. */
  wave?: OscillatorType;
  /** Glide target - the pop's rising inflection. */
  glideTo?: number;
}

/**
 * The schedules. Pentatonic and high on purpose: small intervals up in the
 * sixth octave read as friendly out of phone speakers that cannot carry a
 * bass note anyway.
 */
const SCHEDULES: Record<ChimeKind, Note[]> = {
  tick: [{ at: 0, hz: 1318.5, dur: 0.06, peak: 0.045, wave: 'triangle' }],
  pop: [{ at: 0, hz: 523.3, glideTo: 880, dur: 0.09, peak: 0.06, wave: 'sine' }],
  success: [
    { at: 0, hz: 880, dur: 0.12, peak: 0.06, wave: 'triangle' },
    { at: 0.11, hz: 1318.5, dur: 0.22, peak: 0.055, wave: 'triangle' },
  ],
  fanfare: [
    { at: 0, hz: 1046.5, dur: 0.14, peak: 0.055, wave: 'triangle' },
    { at: 0.09, hz: 1318.5, dur: 0.14, peak: 0.055, wave: 'triangle' },
    { at: 0.18, hz: 1568, dur: 0.16, peak: 0.055, wave: 'triangle' },
    { at: 0.27, hz: 2093, dur: 0.34, peak: 0.06, wave: 'triangle' },
    /* A quiet fifth under the last note - the "sparkle" is really a chord. */
    { at: 0.27, hz: 1568, dur: 0.34, peak: 0.025, wave: 'sine' },
  ],
};

let context: AudioContext | null = null;

/** The context, created on first use and revived if the tab suspended it. */
function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ??
    (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  context ??= new Ctor();
  /* Anything short of running gets a revival attempt: 'suspended' is the
     standard autoplay gate, and iOS adds a non-standard 'interrupted' after
     backgrounding or a phone call that WebKit does not always lift on its
     own. The TS union omits the latter, hence the negative check. */
  if ((context.state as string) !== 'running') {
    void context.resume().catch(() => undefined);
  }
  return context;
}

export function soundEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSoundEnabled(on: boolean): void {
  try {
    if (on) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, 'off');
  } catch {
    /* Private mode without storage still gets sound; it just cannot keep
       the preference. */
  }
}

/**
 * Wake the audio context inside a user gesture, without playing anything.
 *
 * Autoplay policy only lets a context start during a gesture, and some
 * chimes fire from timers or async continuations that are not one - the
 * hold-to-cast success lands at the end of a 3s interval, a verification
 * fanfare at the end of a fetch. Call this in the pointerdown or submit
 * handler that starts such a flow and the later chime finds a context
 * already running.
 */
export function primeChime(): void {
  if (!soundEnabled()) return;
  try {
    ensureContext();
  } catch {
    /* See chime(). */
  }
}

/**
 * Play one of the four chimes. Safe to call anywhere: on the server, with
 * sound muted, or in a browser without Web Audio it is a no-op, and a
 * context that refuses to start fails silently rather than loudly - a
 * missing ornament is not an error.
 */
export function chime(kind: ChimeKind): void {
  if (!soundEnabled()) return;
  try {
    const ctx = ensureContext();
    if (!ctx) return;
    if ((ctx.state as string) === 'running') {
      schedule(ctx, kind);
      return;
    }
    /* Not running: the clock is frozen, and notes scheduled against it
       queue up and all fire the instant some later gesture revives the
       context - eight dial-detent ticks arriving as one blast. So a chime
       on a sleeping context only plays if the resume it asks for lands
       immediately (a brand-new context inside a gesture); a resume that
       resolves later - the NEXT gesture, seconds on - finds its sound
       stale and drops it. */
    const asked = performance.now();
    void ctx
      .resume()
      .then(() => {
        if (performance.now() - asked <= 250) schedule(ctx, kind);
      })
      .catch(() => undefined);
  } catch {
    /* No sound is always an acceptable outcome. */
  }
}

function schedule(ctx: AudioContext, kind: ChimeKind): void {
  try {
    const now = ctx.currentTime;

    for (const note of SCHEDULES[kind]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = note.wave ?? 'triangle';

      const start = now + note.at;
      const end = start + note.dur;
      osc.frequency.setValueAtTime(note.hz, start);
      if (note.glideTo) {
        osc.frequency.exponentialRampToValueAtTime(note.glideTo, end);
      }

      /* Soft attack, exponential release: the difference between a chime
         and a beep. */
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(note.peak, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);

      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(end + 0.02);
    }
  } catch {
    /* No sound is always an acceptable outcome. */
  }
}
