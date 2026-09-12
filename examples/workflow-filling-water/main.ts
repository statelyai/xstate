import { createActor } from 'xstate';
import { workflow } from './workflow.ts';

const actor = createActor(workflow, {
  input: {
    current: 0,
    max: 10
  }
});

actor.subscribe({
  next(snapshot) {
    console.log('workflow state', snapshot.value);
    console.log('workflow context', snapshot.context);
  },
  complete() {
    console.log('workflow completed', actor.getSnapshot().output);
  }
});

actor.start();
