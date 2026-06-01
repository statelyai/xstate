import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@xstate/store-angular',
    include: ['src/**/*.test.{ts,tsx}'],
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts']
  }
});
