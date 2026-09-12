import { createActor } from 'xstate';
import { createInterface } from 'node:readline/promises';
import { createWorkflow } from './workflow.ts';

const rl = createInterface({ input: process.stdin, output: process.stdout });
export const workflow = createWorkflow((question, signal) =>
  rl.question(question, { signal })
);
const actor = createActor(workflow);
actor.subscribe({
  complete() {
    console.log('workflow completed', actor.getSnapshot().output);
    rl.close();
  },
  error(error) {
    console.error('workflow failed', error);
    process.exitCode = 1;
    rl.close();
  }
});
rl.once('close', () => actor.stop());
process.once('SIGINT', () => {
  actor.stop();
  rl.close();
});
actor.start();
