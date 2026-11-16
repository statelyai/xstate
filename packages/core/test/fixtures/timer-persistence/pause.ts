import { createActor, setup } from 'xstate';
import { restoreActor } from 'xstate/persist';

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const machine = setup({
  delays: { remaining: ({ context }) => context.remainingMs }
}).createMachine({
  context: { remainingMs: 10_000, deadline: 0 },
  initial: 'running',
  states: {
    running: {
      entry: ({ context }) => ({
        context: { deadline: Date.now() + context.remainingMs }
      }),
      after: { remaining: { target: 'done' } },
      on: {
        pause: ({ context }) => ({
          target: 'paused',
          context: { remainingMs: Math.max(0, context.deadline - Date.now()) }
        })
      }
    },
    paused: { on: { resume: { target: 'running' } } },
    done: { type: 'final' }
  }
});

export async function resumeRemaining() {
  const actor = createActor(machine).start();
  await wait(4_000);
  actor.send({ type: 'pause' });
  const stored = JSON.stringify(actor.getPersistedSnapshot());
  actor.stop();

  await wait(3_000);
  const restored = restoreActor(machine, JSON.parse(stored)).start();
  restored.send({ type: 'resume' });
  return restored;
}
