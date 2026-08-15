import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: '@xstate/rivet',
    include: ['test/contract/**/*.test.ts'],
    globals: true,
    environment: 'node'
  }
});
