import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { dedupe: ['react', 'react-dom', 'use-sync-external-store'] },
  test: {
    name: '@xstate/example-effect-workflows',
    globals: true,
    environment: 'happy-dom',
    testTimeout: 10000
  }
});
