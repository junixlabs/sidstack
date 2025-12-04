import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      include: ['src/impact/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/types.ts', 'src/**/index.ts'],
      reporter: ['text', 'html'],
    },
  },
});
