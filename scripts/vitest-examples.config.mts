import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { conditions: ['module', 'development', 'browser'] },
  ssr: { resolve: { conditions: ['module', 'development', 'node'] } },
  test: {
    include: [
      'examples/snake-react/src/snakeMachine.test.ts',
      'examples/*/src/*.machine.test.ts',
      'examples/express-workflow/*.test.ts',
      'examples/mongodb-persisted-state/*.test.ts',
      'examples/mongodb-credit-check-api/*.test.ts',
      'examples/workflow-*/workflow.test.ts'
    ]
  }
});
