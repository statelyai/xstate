import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'packages/*',
      'examples/effect-workflows/vitest.config.ts',
      'packages/xstate-store/vitest.config.{solid,vue}.mts'
    ]
  }
});
