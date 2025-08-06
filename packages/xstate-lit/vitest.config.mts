import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    globals: true,
    setupFiles: ['./setup-file.mts'],
    browser: {
      enabled: true,
      provider: 'playwright',
      headless: true,
      instances: [{ browser: 'chromium' }]
    }
  }
});
