import solid from 'vite-plugin-solid';
import { defineProject } from 'vitest/config';

export const include = ['test/solid.test.tsx'];

export default defineProject({
  plugins: [solid() as any],
  test: {
    name: 'xstate-store-solid',
    include,
    globals: true,
    environment: 'happy-dom',
    server: {
      deps: {
        // fixes: You appear to have multiple instances of Solid
        // https://github.com/solidjs/vite-plugin-solid/issues/120
        inline: ['solid-js', '@solidjs/testing-library']
      }
    }
  },
  resolve: {
    conditions: ['development', 'browser']
  }
});
