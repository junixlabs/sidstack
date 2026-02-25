import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/e2e-flows.integration.test.ts'],
    // NO setupFiles — we want real DB, not mocked
    testTimeout: 30000,
  },
});
