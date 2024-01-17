import { createMachine, createActor } from 'xstate';

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

const actor = createActor(workflow);

actor.subscribe({
  complete() {
    console.log('workflow completed', actor.getSnapshot().output);
  }
});

actor.start();
