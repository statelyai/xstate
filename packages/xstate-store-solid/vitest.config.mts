import { defineProject } from 'vitest/config';
import solidPlugin from 'vite-plugin-solid';
import path from 'path';

export default defineProject({
  plugins: [solidPlugin()],
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    globals: true,
    environment: 'happy-dom',
    server: {
      deps: {
        inline: ['solid-js', '@solidjs/testing-library']
      }
    }
  },
  resolve: {
    conditions: ['development', 'browser'],
    alias: {
      '@xstate/store': path.resolve(__dirname, '../xstate-store/src/index.ts')
    }
  }
});
