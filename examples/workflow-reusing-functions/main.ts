import { createActor, toPromise } from 'xstate';
import { parentWorkflow } from './workflow.ts';

const actor = createActor(parentWorkflow).start();
const completed = toPromise(actor);
actor.send({
  type: 'PaymentReceivedEvent',
  accountId: '1234',
  payment: { amount: 100 },
  customer: { name: 'John Doe' },
  funds: { available: true }
});
try {
  console.log('workflow completed', await completed);
} finally {
  actor.stop();
}
