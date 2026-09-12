import { createMachine } from 'xstate';

// https://github.com/serverlessworkflow/specification/tree/main/examples#hello-world-example
export const workflow = createMachine({
  id: 'helloworld',
  initial: 'Hello State',
  states: {
    'Hello State': {
      type: 'final',
      output: {
        result: 'Hello World!'
      }
    }
  }
});
