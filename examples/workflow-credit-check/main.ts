import { createActor } from 'xstate';
import { workflow } from './workflow.ts';

const actor = createActor(workflow, {
  input: {
    customer: {
      id: 'customer123',
      name: 'John Doe',
      SSN: 123456,
      yearlyIncome: 50000,
      address: '123 MyLane, MyCity, MyCountry',
      employer: 'MyCompany'
    }
  },
  inspect: (inspEv) => {
    if (inspEv.type === '@xstate.transition') {
      console.log('Received event', inspEv.event);
    }
  }
});
actor.subscribe({
  complete() {
    console.log('workflow completed', actor.getSnapshot().output);
  }
});
actor.start();
