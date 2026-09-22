import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    fileParallelism: false,
    maxWorkers: 1,
    isolate: false,
    environment: 'node',
    testTimeout: 30000,
    sequence: {
      concurrent: false,
    },
  },
});
