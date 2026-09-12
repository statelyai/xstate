import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  use: { baseURL: 'http://localhost:5310' },
  webServer: {
    command: 'node server.mjs',
    url: 'http://localhost:5310',
    reuseExistingServer: true
  }
});
