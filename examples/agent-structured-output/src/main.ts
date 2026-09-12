import { createActor, toPromise } from 'xstate';
import { log, structuredOutputMachine } from './structuredOutputMachine.ts';
import { createInspector } from '@statelyai/sdk';

const inspector = process.env.INSPECT ? createInspector() : undefined;

async function run(
  label: string,
  input: { spec: string; alwaysInvalid?: boolean }
) {
  log(`--- ${label} ---`);
  const actor = createActor(structuredOutputMachine, {
    input,
    inspect: inspector?.inspect
  });
  actor.subscribe((snapshot) =>
    log(`state: ${JSON.stringify(snapshot.value)}`)
  );
  actor.start();
  log(`result: ${JSON.stringify(await toPromise(actor))}`);
}

await run('repairs twice, then succeeds', {
  spec: 'ship the release notes'
});
await run('never valid, gives up after 3 attempts', {
  spec: 'ship the release notes',
  alwaysInvalid: true
});

inspector?.destroy();
