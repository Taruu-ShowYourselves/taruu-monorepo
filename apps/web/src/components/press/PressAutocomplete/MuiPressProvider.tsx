'use client';

import React from 'react';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { prefixer } from 'stylis';
import rtlPlugin from 'stylis-plugin-rtl';

/**
 * Emotion cache (RTL-flipped) + a minimal MUI theme keyed to the press
 * design tokens. Mount around any subtree that uses MUI components.
 */
const pressTheme = createTheme({
  direction: 'rtl',
  typography: {
    fontFamily: 'var(--np-font-meta)',
  },
  shape: {
    borderRadius: 10,
  },
  palette: {
    primary: { main: '#E0301E' },
    text: { primary: '#14110E', secondary: '#6E675A' },
    background: { paper: '#FBFAF4' },
  },
});

export function MuiPressProvider({ children }: { children: React.ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ key: 'muirtl', stylisPlugins: [prefixer, rtlPlugin] }}>
      <ThemeProvider theme={pressTheme}>{children}</ThemeProvider>
    </AppRouterCacheProvider>
  );
}
