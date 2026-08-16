import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    exclude: ['node_modules', 'tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/types/',
      ],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      /**
       * `server-only` throws from its default entry by design; Next swaps it for
       * an empty module through the `react-server` export condition, which a
       * plain-Node Vitest run does not apply. Without this alias every test that
       * imports a `server/app/**` or `server/infra/**` module would abort on
       * load. See src/__tests__/stubs/server-only.ts.
       */
      'server-only': resolve(__dirname, './src/__tests__/stubs/server-only.ts'),
    },
  },
});
