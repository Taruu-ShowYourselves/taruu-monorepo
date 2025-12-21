/**
 * Sync Design System - Color Tokens
 * Shared across web and mobile platforms
 */

export const colors = {
  // Primary - Trust Blue
  primary: {
    DEFAULT: '#2563EB',
    light: '#3B82F6',
    dark: '#1D4ED8',
    50: '#EFF6FF',
    100: '#DBEAFE',
    200: '#BFDBFE',
    300: '#93C5FD',
    400: '#60A5FA',
    500: '#3B82F6',
    600: '#2563EB',
    700: '#1D4ED8',
    800: '#1E40AF',
    900: '#1E3A8A',
  },

  // Secondary - Growth Green
  secondary: {
    DEFAULT: '#10B981',
    light: '#34D399',
    dark: '#059669',
    50: '#ECFDF5',
    100: '#D1FAE5',
    200: '#A7F3D0',
    300: '#6EE7B7',
    400: '#34D399',
    500: '#10B981',
    600: '#059669',
    700: '#047857',
    800: '#065F46',
    900: '#064E3B',
  },

  // Accent - Innovation Purple
  accent: {
    DEFAULT: '#8B5CF6',
    light: '#A78BFA',
    dark: '#7C3AED',
    50: '#F5F3FF',
    100: '#EDE9FE',
    200: '#DDD6FE',
    300: '#C4B5FD',
    400: '#A78BFA',
    500: '#8B5CF6',
    600: '#7C3AED',
    700: '#6D28D9',
    800: '#5B21B6',
    900: '#4C1D95',
  },

  // Neutral
  neutral: {
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#E5E5E5',
    300: '#D4D4D4',
    400: '#A3A3A3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
    950: '#0A0A0A',
  },

  // Semantic
  background: {
    DEFAULT: '#FFFFFF',
    secondary: '#FAFAFA',
    tertiary: '#F5F5F5',
  },

  surface: {
    DEFAULT: '#FFFFFF',
    elevated: '#FFFFFF',
  },

  text: {
    primary: '#171717',
    secondary: '#525252',
    muted: '#737373',
    disabled: '#A3A3A3',
    inverse: '#FFFFFF',
  },

  border: {
    DEFAULT: '#E5E5E5',
    light: '#F5F5F5',
    strong: '#D4D4D4',
  },

  // Status
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#2563EB',
} as const;

export type Colors = typeof colors;
