import { createActor } from 'xstate';
import { workflow } from './workflow.ts';

const actor = createActor(workflow);
actor.subscribe({
  next(snapshot) {
    console.log(snapshot.context);
  },
  complete() {
    console.log('workflow completed', actor.getSnapshot().output);
  }
});
actor.start();
actor.send({
  type: 'bookLendingRequest',
  book: {
    title: "The Hitchhiker's Guide to the Galaxy",
    id: '42'
  },
  lender: {
    name: 'John Doe',
    address: ' ... ',
    phone: ' ... '
  }
});
