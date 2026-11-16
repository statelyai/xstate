import { createActor, createMachine } from 'xstate';
import { restoreActor } from 'xstate/persist';

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const machine = createMachine({
  initial: 'waiting',
  states: {
    waiting: {
      after: { 10_000: { target: 'done' } }
    },
    done: { type: 'final' }
  }
});

export async function resumeDeadline() {
  const actor = createActor(machine).start();
  await wait(4_000);
  const stored = JSON.stringify(actor.getPersistedSnapshot());
  actor.stop();

  await wait(3_000);
  const restored = restoreActor(machine, JSON.parse(stored)).start();
  return restored;
}
