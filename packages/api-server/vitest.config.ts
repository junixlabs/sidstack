import { defineConfig } from 'vitest/config';

// Set env vars before any test modules are evaluated
// Random port avoids EADDRINUSE when real API server is running
process.env.API_PORT = '0';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    testTimeout: 10000,
  },
});
