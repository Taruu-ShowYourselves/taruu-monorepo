'use client';

import { createContext, useContext } from 'react';

/**
 * The carousel's drag, handed to the tiles.
 *
 * Both the track and the tiles want the same two axes: sideways is the desk
 * scrolling, downwards is the page scrolling, and the swipe-vote needs both.
 * Rather than split the axes - which would cost the reader either the desk or
 * the page - a tile takes the whole pointer for the length of one gesture and
 * gives it straight back.
 *
 * `locked` is read inside Embla's `watchDrag`, which runs on every pointer
 * down, so a lock taken mid-gesture also stops a second finger starting the
 * track moving under the tile being pushed.
 */
export interface DeskDragLock {
  /** Live flag, read at pointer-down time. A ref, not state: no render. */
  readonly locked: { current: boolean };
  lock: () => void;
  release: () => void;
}

/**
 * Outside a carousel - the tile rendered on its own, or in a test - the lock
 * is a no-op rather than an error: there is no track to hold still.
 */
const NO_TRACK: DeskDragLock = {
  locked: { current: false },
  lock: () => {},
  release: () => {},
};

export const DeskDragLockContext = createContext<DeskDragLock>(NO_TRACK);

export function useDeskDragLock(): DeskDragLock {
  return useContext(DeskDragLockContext);
}
