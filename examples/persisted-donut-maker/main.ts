import { createActor } from 'xstate';
import { promises as fs } from 'fs';
import { donutMachine } from './donutMachine';

const FILENAME = './persisted-state.json';

let restoredState;
try {
  restoredState = JSON.parse(await fs.readFile(FILENAME, 'utf8'));
} catch (e) {
  console.log('No persisted state found.');
  restoredState = undefined;
}

const actor = createActor(donutMachine, {
  state: restoredState
});

actor.subscribe({
  next(snapshot) {
    console.log(
      'Current state:',
      // the current state, bolded
      `\x1b[1m${JSON.stringify(snapshot.value)}\x1b[0m\n`,
      'Next events:',
      // the next events, each of them bolded
      snapshot.nextEvents
        .filter((event) => !event.startsWith('done.'))
        .map((event) => `\n  \x1b[1m${event}\x1b[0m`)
        .join(''),
      '\nEnter the next event to send:'
    );

    // save persisted state to json file
    const persistedState = actor.getPersistedState();
    fs.writeFile(FILENAME, JSON.stringify(persistedState));
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
