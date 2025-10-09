import vue from '@vitejs/plugin-vue';
import { defineProject } from 'vitest/config';

export const include = ['test/*.test.ts'];

export default defineProject({
  plugins: [vue()],
  test: {
    include,
    globals: true,
    environment: 'happy-dom'
  }
});
