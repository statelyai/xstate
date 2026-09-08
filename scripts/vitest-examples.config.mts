import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { conditions: ['module', 'development', 'browser'] },
  ssr: { resolve: { conditions: ['module', 'development', 'node'] } },
  test: { include: ['examples/snake-react/src/snakeMachine.test.ts'] }
});
