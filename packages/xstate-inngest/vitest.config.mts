import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: '@xstate/inngest',
    include: ['test/**/*.test.ts'],
    globals: true,
    environment: 'node'
  }
});
