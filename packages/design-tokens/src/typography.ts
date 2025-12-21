/**
 * Sync Design System - Typography Tokens
 * Scale: 1.2 (Minor Third)
 * Base: 16px
 */

export const typography = {
  // Font Families
  fonts: {
    primary: 'Heebo',
    secondary: 'Assistant',
    mono: 'Fira Code',
  },

  // Font Sizes - Scale 1.2
  sizes: {
    xs: 11.1,      // 0.694rem
    sm: 13.3,      // 0.833rem
    base: 16,      // 1rem
    lg: 19.2,      // 1.2rem
    xl: 23,        // 1.44rem
    '2xl': 27.6,   // 1.728rem
    '3xl': 33.2,   // 2.074rem
    '4xl': 39.8,   // 2.488rem
    '5xl': 47.8,   // 2.986rem
    '6xl': 57.3,   // 3.583rem
    '7xl': 68.8,   // 4.3rem
    '8xl': 82.6,   // 5.16rem
    '9xl': 99.1,   // 6.192rem
  },

  // Font Weights
  weights: {
    light: '300',
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
    black: '900',
  },

  // Line Heights
  lineHeights: {
    none: 1,
    tight: 1.1,
    snug: 1.25,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },

  // Letter Spacing
  letterSpacing: {
    tighter: -0.8,
    tight: -0.4,
    normal: 0,
    wide: 0.4,
    wider: 0.8,
    widest: 1.6,
  },
} as const;

export type Typography = typeof typography;

// Helper to get rem value
export function toRem(px: number): string {
  return `${px / 16}rem`;
}

// Helper to get font size in rem
export function getFontSize(size: keyof typeof typography.sizes): string {
  return toRem(typography.sizes[size]);
}
