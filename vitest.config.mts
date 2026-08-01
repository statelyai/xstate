import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'packages/*',
      'packages/xstate-store/vitest.config.{solid,vue}.mts'
    ]
  }
});
