import { createActor } from 'xstate';
import { workflow } from './workflow.ts';

const actor = createActor(workflow, {
  inspect: (inspEv) => {
    if (inspEv.type === '@xstate.transition') {
      console.log('Received event', inspEv.event);
    }
  }
});

actor.subscribe({
  next(state) {
    console.log(state.context);
  },
  complete() {
    console.log('workflow completed', actor.getSnapshot().output);
  }
});

actor.start();

// delay 1000
await new Promise((resolve) => setTimeout(resolve, 1000));

actor.send({
  type: 'CarBidEvent',
  bid: {
    carid: 'car123',
    amount: 3000,
    bidder: {
      id: 'xyz',
      firstName: 'John',
      lastName: 'Wayne'
    }
  }
});

// delay 1000
await new Promise((resolve) => setTimeout(resolve, 1000));

actor.send({
  type: 'CarBidEvent',
  bid: {
    carid: 'car123',
    amount: 4000,
    bidder: {
      id: 'abc',
      firstName: 'Jane',
      lastName: 'Doe'
    }
  }
});
