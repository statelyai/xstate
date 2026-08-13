import { defineProject } from 'vitest/config';

export default defineProject({
  root: import.meta.dirname,
  test: {
    name: '@xstate/rivet-integration',
    include: ['test/integration/**/*.test.ts'],
    globals: true,
    environment: 'node',
    pool: 'forks'
  }
});
