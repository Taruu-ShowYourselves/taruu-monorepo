'use client';

import { createContext, useContext } from 'react';

/**
 * Whether the desk is inside a tab panel the reader can currently see.
 *
 * The tabbed section keeps both editions mounted - the hidden one is laid
 * out under `visibility: hidden` so Embla keeps its measurements - which
 * means geometry-based machinery (the drift engine, the swipe-lesson
 * IntersectionObserver) cannot tell it is invisible on its own. The tabs
 * publish the fact instead, and the desk's moving parts stand down while
 * nobody can see them.
 *
 * Defaults to true: a desk outside any tabs is always its own visible panel.
 */
export const DeskPanelActiveContext = createContext(true);

export const useDeskPanelActive = () => useContext(DeskPanelActiveContext);
