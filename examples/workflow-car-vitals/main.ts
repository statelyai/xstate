import { createActor } from 'xstate';
import { setTimeout as delay } from 'node:timers/promises';
import { workflow } from './workflow.ts';

const actor = createActor(workflow);
actor.subscribe({
  error: (error) => {
    console.error('workflow failed', error);
    process.exitCode = 1;
  }
});
actor.start();
try {
  await delay(1000);
  actor.send({ type: 'CarTurnedOnEvent' });
  await delay(6000);
  actor.send({ type: 'CarTurnedOffEvent' });
} finally {
  actor.stop();
}
