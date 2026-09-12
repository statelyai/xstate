import { __unsafe_getAllOwnEventDescriptors, createActor } from 'xstate';
import { promises as fs } from 'fs';
import { donutMachine } from './donutMachine';
import { createSnapshotWriter } from './snapshotWriter';

const FILENAME = './persisted-state.json';

let restoredState;
try {
  restoredState = JSON.parse(await fs.readFile(FILENAME, 'utf8'));
} catch (e) {
  if (!(e instanceof Error) || !('code' in e) || e.code !== 'ENOENT') {
    throw e;
  }
  console.log('No persisted state found.');
  restoredState = undefined;
}

const actor = createActor(donutMachine, {
  snapshot: restoredState
});
const writer = createSnapshotWriter(FILENAME);
const reportWriteError = (error: unknown) => {
  console.error('Could not save persisted state:', error);
  process.exitCode = 1;
};

actor.subscribe({
  next(snapshot) {
    const nextEvents = __unsafe_getAllOwnEventDescriptors(snapshot);
    console.log(
      'Current state:',
      // the current state, bolded
      `\x1b[1m${JSON.stringify(snapshot.value)}\x1b[0m\n`,
      'Next events:',
      // the next events, each of them bolded
      nextEvents
        .filter((event) => !event.startsWith('done.'))
        .map((event) => `\n  \x1b[1m${event}\x1b[0m`)
        .join(''),
      '\nEnter the next event to send:'
    );

    // save persisted state to json file
    const persistedState = actor.getPersistedSnapshot();
    void writer.write(persistedState).catch(reportWriteError);
  },
  complete() {
    console.log('workflow completed', actor.getSnapshot().output);
  }
});

actor.start();

process.stdin.on('data', (data) => {
  const eventType = data.toString().trim();
  actor.send({ type: eventType });
});

async function shutdown() {
  actor.stop();
  process.stdin.pause();
  await writer.flush().catch(reportWriteError);
}
process.once('SIGINT', shutdown);
process.stdin.once('end', shutdown);
