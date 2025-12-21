const { colors, spacing, borderRadius } = require('@sync/design-tokens');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: colors.primary,
        secondary: colors.secondary,
        accent: colors.accent,
        neutral: colors.neutral,
        success: colors.success,
        error: colors.error,
        warning: colors.warning,
      },
      fontFamily: {
        heebo: ['Heebo'],
        assistant: ['Assistant'],
      },
    },
  },
  plugins: [],
};
