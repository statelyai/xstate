import { createActor } from 'xstate';
import { workflow } from './workflow.ts';

const actor = createActor(workflow);
actor.subscribe({
  complete() {
    console.log('workflow completed', actor.getSnapshot().output);
  }
});
actor.start();
