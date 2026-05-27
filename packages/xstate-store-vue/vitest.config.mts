import { defineProject } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineProject({
  plugins: [vue()],
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    globals: true,
    environment: 'happy-dom'
  },
  resolve: {
    conditions: ['development', 'browser']
  }
});
