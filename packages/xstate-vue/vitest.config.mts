import vue from '@vitejs/plugin-vue';
import { defineProject } from 'vitest/config';

export default defineProject({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'happy-dom'
  }
});
