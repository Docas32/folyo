import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'jsdom',
    environmentMatchGlobs: [
      ['apps/web/components/**/*.test.{ts,tsx}', 'jsdom'],
      ['apps/web/lib/**/*.test.ts', 'node'],
      ['apps/*/src/**/*.test.ts', 'node'],
      ['packages/*/src/**/*.test.ts', 'node'],
    ],
    include: [
      'apps/*/src/**/*.test.ts',
      'apps/web/lib/**/*.test.ts',
      'apps/web/components/**/*.test.{ts,tsx}',
      'packages/*/src/**/*.test.ts',
    ],
    globals: true,
    setupFiles: ['./apps/web/test-setup.ts'],
  },
});
