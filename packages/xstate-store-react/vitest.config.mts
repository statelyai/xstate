import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    globals: true,
    environment: 'happy-dom'
  },
  resolve: {
    conditions: ['development', 'browser']
  }
});
