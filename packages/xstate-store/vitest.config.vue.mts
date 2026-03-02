import vue from '@vitejs/plugin-vue';
import path from 'path';
import { defineProject } from 'vitest/config';

export const include = ['test/vue.test.ts'];

export default defineProject({
  plugins: [vue()],
  test: {
    name: 'xstate-store-vue',
    include,
    globals: true,
    environment: 'happy-dom'
  },
  resolve: {
    alias: {
      '@xstate/vue': path.resolve(__dirname, '../xstate-vue/src/index.ts'),
      xstate: path.resolve(__dirname, '../core/src/index.ts')
    }
  }
});
