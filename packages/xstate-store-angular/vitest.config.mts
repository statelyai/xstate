import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    name: '@xstate/store-angular',
    include: ['src/**/*.test.{ts,tsx}'],
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts']
  },
  resolve: {
    alias: {
      '@xstate/store': path.resolve(__dirname, '../xstate-store/src/index.ts')
    }
  }
});
