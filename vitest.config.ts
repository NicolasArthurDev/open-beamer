import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@open-beamer/engine': fileURLToPath(
        new URL('./packages/engine/src/index.ts', import.meta.url),
      ),
      '@open-beamer/editing': fileURLToPath(
        new URL('./packages/editing/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    include: ['packages/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60000,
  },
});
