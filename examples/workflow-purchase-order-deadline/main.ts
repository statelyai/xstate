import { createActor } from 'xstate';
import { workflow, delay } from './workflow.ts';

const actor = createActor(workflow);
actor.subscribe({
  complete() {
    console.log('workflow completed', actor.getSnapshot().output);
  }
});
actor.start();
actor.send({
  type: 'OrderCreatedEvent'
});
await delay(10000);
actor.send({
  type: 'OrderConfirmedEvent'
});
await delay(10000);
actor.send({
  type: 'ShipmentSentEvent'
});
