import { defineProject } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineProject({
  plugins: [vue()],
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    globals: true,
    environment: 'happy-dom'
  },
  resolve: {
    conditions: ['development', 'browser'],
    alias: {
      '@xstate/store': path.resolve(__dirname, '../xstate-store/src/index.ts')
    }
  }
});
