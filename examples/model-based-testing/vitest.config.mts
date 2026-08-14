import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resolve the workspace `xstate` package to its source entry points.
  ssr: { resolve: { conditions: ['module'] } },
  test: {
    include: ['src/**/*.test.ts']
  }
});
