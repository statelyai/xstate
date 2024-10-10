import { defineConfig } from 'vite';
import { rollupPluginHTML } from '@web/rollup-plugin-html';

export default defineConfig({
  plugins: [rollupPluginHTML()],
  build: {
    rollupOptions: {
      input: 'demo/*.html',
      output: {
        format: 'es'
      }
    }
  }
});
