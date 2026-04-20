import { defineProject } from 'vitest/config';
import preact from '@preact/preset-vite';
import path from 'path';

export default defineProject({
  plugins: [preact()],
  test: {
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
