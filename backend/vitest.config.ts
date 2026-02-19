import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    clearMocks: true,
    // Tests share a real PostgreSQL DB; run files sequentially to avoid interference
    fileParallelism: false,
  },
});
