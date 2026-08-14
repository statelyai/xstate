import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Preconstruct's dev-mode CJS proxy files break Node ESM resolution;
  // prefer the "module" condition like the tsx-based examples do.
  ssr: { resolve: { conditions: ['module'] } },
  test: {
    include: ['src/**/*.test.ts']
  }
});
