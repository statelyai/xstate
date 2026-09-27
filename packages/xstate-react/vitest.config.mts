import { defineProject } from 'vitest/config';

export default defineProject({
  resolve: { conditions: ['module', 'development', 'browser'] },
  test: {
    globals: true,
    environment: 'happy-dom'
  }
});
