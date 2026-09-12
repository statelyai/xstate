import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Preconstruct development links expose source via the module condition.
  resolve: { conditions: ['module', 'development', 'browser'] },
  ssr: { resolve: { conditions: ['module', 'development', 'node'] } },
  test: {
    include: ['examples/**/*.{test,spec}.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      // These use node:test and run separately through test:tooling.
      'examples/persisted-donut-maker/snapshotWriter.test.ts',
      'examples/snake-react/src/occupancy.test.ts'
    ]
  }
});
