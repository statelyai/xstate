import { createActor, toPromise } from 'xstate';
import { log, streamingMachine } from './streamingMachine.ts';
import { createInspector } from '@statelyai/sdk';

const inspector = process.env.INSPECT ? createInspector() : undefined;

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

async function run(
  label: string,
  input: { prompt: string; failAfter: number | null },
  cancelAfter?: number
) {
  log(`--- ${label} ---`);
  const actor = createActor(streamingMachine, {
    input,
    inspect: inspector?.inspect
  });
  actor.subscribe((snapshot) =>
    log(`state: ${JSON.stringify(snapshot.value)}`)
  );
  actor.start();

  if (cancelAfter !== undefined) {
    void wait(cancelAfter).then(() => actor.send({ type: 'cancel' }));
  }

  log(`result: ${JSON.stringify(await toPromise(actor))}`);
}

await run('streams to completion', { prompt: 'why states?', failAfter: null });
await run(
  'cancelled mid-stream',
  { prompt: 'long answer', failAfter: null },
  400
);
await run('fails once, then retries', { prompt: 'flaky', failAfter: 2 });

inspector?.destroy();
