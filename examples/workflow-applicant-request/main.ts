import { createActor } from 'xstate';
import { workflow } from './workflow.ts';

const actor = createActor(workflow, {
  input: {
    applicant: {
      fname: 'John',
      lname: 'Stockton',
      age: 22,
      email: 'js@something.com'
    }
  }
});
actor.subscribe({
  complete() {
    console.log('workflow completed', actor.getSnapshot().output);
  }
});
actor.start();
console.log('Type Submit and press Enter to evaluate the application.');
process.stdin.on('data', (data) => {
  const eventType = data.toString().trim();
  actor.send({ type: eventType });
});
