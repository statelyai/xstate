import { createActor } from 'xstate';
import { workflow } from './workflow.ts';

const actor = createActor(workflow, {
  input: {
    orders: [
      {
        id: '123',
        item: 'laptop',
        quantity: '10'
      },
      {
        id: '456',
        item: 'desktop',
        quantity: '4'
      }
    ]
  }
});
actor.subscribe({
  complete() {
    console.log('workflow completed', actor.getSnapshot().output);
  }
});
actor.start();
