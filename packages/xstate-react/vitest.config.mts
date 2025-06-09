import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    globals: true,
    environment: 'happy-dom'
  }
});
