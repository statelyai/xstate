import { promises as fs } from 'node:fs';
import { createInterface } from 'node:readline';
import { createActor } from 'xstate';
import { donutMachine } from './donutMachine';

const FILENAME = './persisted-state.json';

let restoredSnapshot;
try {
  restoredSnapshot = JSON.parse(await fs.readFile(FILENAME, 'utf8'));
} catch {
  console.log('No persisted state found.');
}

const actor = createActor(donutMachine, { snapshot: restoredSnapshot });

const bold = (value: string) => `\x1b[1m${value}\x1b[0m`;

actor.subscribe({
  next(snapshot) {
    // Events the machine declares, narrowed to the ones the current
    // snapshot can actually take.
    const nextEvents = donutMachine.events.filter(
      (type) => !type.startsWith('done.') && snapshot.can({ type })
    );

    console.log(
      'Current state:',
      `${bold(JSON.stringify(snapshot.value))}\n`,
      'Next events:',
      nextEvents.map((type) => `\n  ${bold(type)}`).join(''),
      '\nEnter the next event to send:'
    );

    fs.writeFile(FILENAME, JSON.stringify(actor.getPersistedSnapshot()));
  },
  complete() {
    console.log('workflow completed', actor.getSnapshot().output);
  }
});

actor.start();

const input = createInterface({ input: process.stdin });

for await (const line of input) {
  actor.send({ type: line.trim() });
}
