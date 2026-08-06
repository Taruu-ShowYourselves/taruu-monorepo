/**
 * The desk's continuous sway, as an Embla plugin that can change gear.
 *
 * `embla-carousel-auto-scroll` resolves its `speed` once at init and keeps a
 * private merged copy, so the only way to re-pace it is to hand the hook a new
 * instance - and a re-init snaps the track to its nearest slide, which reads as
 * the carousel jumping backwards the moment a cursor arrives. This plugin uses
 * the same mechanism the official one does (it installs a `scrollBody` on the
 * engine) but keeps the speed in a live cell and eases toward it, so slowing
 * under a cursor is a glide rather than a cut.
 */

import type { CreatePluginType, EmblaCarouselType } from 'embla-carousel';

declare module 'embla-carousel' {
  interface EmblaPluginsType {
    deskDrift: DeskDriftType;
  }
}

export interface DeskDriftOptions {
  /** Pixels per frame at the resting pace. */
  speed: number;
  /** Milliseconds of stillness before the sway begins. */
  startDelay?: number;
  /**
   * Fraction of the remaining speed difference closed each frame. 0.06 spends
   * roughly a quarter-second on a gear change - long enough to read as the
   * desk easing off, short enough to feel answerable to the cursor.
   */
  easing?: number;
}

/** Ease toward a new pace with `setSpeed`; it takes effect on the next frame. */
export type DeskDriftType = CreatePluginType<
  {
    setSpeed: (speed: number) => void;
    pageOver: () => void;
  },
  Record<string, never>
>;

export function DeskDrift(userOptions: DeskDriftOptions): DeskDriftType {
  const easing = userOptions.easing ?? 0.06;
  const startDelay = userOptions.startDelay ?? 0;

  let emblaApi: EmblaCarouselType;
  let timerId = 0;
  let destroyed = false;
  /** The pace we are heading for, and the one actually applied this frame. */
  let targetSpeed = userOptions.speed;
  let currentSpeed = userOptions.speed;
  /**
   * The engine's own scroll body, kept so control can be handed back. Embla
   * animates a `scrollTo` (the paging arrows, a drag's momentum) through
   * whichever body is installed, and a body that only ever drifts would ignore
   * the target - which is how an arrow click turns into a no-op.
   */
  let defaultBody: unknown = null;

  function init(emblaApiInstance: EmblaCarouselType): void {
    emblaApi = emblaApiInstance;
    const engine = emblaApi.internalEngine();
    defaultBody = engine.scrollBody;
    timerId = engine.ownerWindow.setTimeout(() => {
      if (destroyed) return;
      resume();
    }, startDelay);
    // A drag hands the track to the reader; the sway picks up where they left
    // it once the carousel has settled again.
    emblaApi.on('pointerDown', handOver);
    emblaApi.on('pointerUp', resumeOnSettle);
  }

  function destroy(): void {
    destroyed = true;
    if (!emblaApi) return;
    emblaApi.internalEngine().ownerWindow.clearTimeout(timerId);
    emblaApi.off('pointerDown', handOver).off('pointerUp', resumeOnSettle).off('settle', settle);
    timerId = 0;
  }

  /** Give the engine its own body back, so it can animate to a target. */
  function handOver(): void {
    if (destroyed || !defaultBody) return;
    emblaApi.internalEngine().scrollBody =
      defaultBody as ReturnType<typeof driftBody>;
  }

  function resume(): void {
    if (destroyed) return;
    const engine = emblaApi.internalEngine();
    engine.scrollBody = driftBody();
    engine.animation.start();
  }

  function resumeOnSettle(): void {
    emblaApi.on('settle', settle);
  }

  function settle(): void {
    emblaApi.off('settle', settle);
    resume();
  }

  /**
   * The engine's scroll body for a drifting track: every frame it advances the
   * location by the current speed and re-publishes the selected index, the
   * same contract `embla-carousel-auto-scroll` implements.
   */
  function driftBody() {
    const engine = emblaApi.internalEngine();
    const { location, previousLocation, target, index, indexPrevious, scrollTarget } = engine;

    // The track is RTL and loops, so the sign is fixed and there is no end to
    // reach - the constrain/settle branch the official plugin needs for
    // non-looping carousels has no counterpart here.
    let velocity = 0;
    const noop = () => body;

    const seek = () => {
      previousLocation.set(location);
      currentSpeed += (targetSpeed - currentSpeed) * easing;
      velocity = -currentSpeed;
      location.add(velocity);
      target.set(location);

      const currentIndex = scrollTarget.byDistance(0, false).index;
      if (index.get() !== currentIndex) {
        indexPrevious.set(index.get());
        index.set(currentIndex);
        emblaApi.emit('select');
      }
      return body;
    };

    const body = {
      direction: () => Math.sign(velocity),
      duration: () => -1,
      velocity: () => velocity,
      settled: () => false,
      seek,
      useBaseFriction: noop,
      useBaseDuration: noop,
      useFriction: noop,
      useDuration: noop,
    };

    return body;
  }

  const self: DeskDriftType = {
    name: 'deskDrift',
    options: {},
    init,
    destroy,
    setSpeed: (speed: number) => {
      targetSpeed = speed;
    },
    /**
     * Hand the track to a deliberate scroll (an arrow click) and take the sway
     * back once it settles. Call it immediately before `scrollNext`/`scrollPrev`.
     */
    pageOver: () => {
      handOver();
      resumeOnSettle();
    },
  };

  return self;
}
