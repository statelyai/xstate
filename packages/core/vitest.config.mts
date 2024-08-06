import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    globals: true,
    environmentMatchGlobs: [['test/errors.test.ts', 'happy-dom']]
  }
});
