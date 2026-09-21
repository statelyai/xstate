import vue from '@vitejs/plugin-vue';
import { defineProject } from 'vitest/config';

export const include = ['test/vue.test.ts'];

export default defineProject({
  resolve: { conditions: ['module', 'development', 'browser'] },
  plugins: [vue()],
  test: {
    name: 'xstate-store-vue',
    include,
    globals: true,
    environment: 'happy-dom'
  }
});
