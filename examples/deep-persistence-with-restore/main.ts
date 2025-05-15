import { Snapshot, createActor } from 'xstate';
import { promises as fs } from 'fs';
import { UpDownMaschine } from './machines';
import { createActors, delay } from './actors';

const FILENAME = './historyStates.json';
const PROVISION_TIMEOUT = 30000;

let historyStates: Snapshot<any>[] = [];
async function updateHistory(state: any) {
  try {
    historyStates = JSON.parse(await fs.readFile(FILENAME, 'utf8'));
  } catch (e) {
    console.log('No history states found.');
    historyStates = [];
  }
  historyStates = [state, ...historyStates];
  await fs.writeFile(FILENAME, JSON.stringify(historyStates));
}

async function provisionFactory(actors: any, retry = false) {
  let restoredState;

  if (retry) {
    try {
      const history: any[] = JSON.parse(await fs.readFile(FILENAME, 'utf8'));
      restoredState = history[1];
    } catch (e) {
      restoredState = undefined;
      console.log('No history found');
    }
    console.log(restoredState);
  }

  const upDown = createActor(UpDownMaschine.provide({ actors }), {
    state: restoredState
  });
  upDown.subscribe({
    next(state) {
      console.log('---next', state.value);
      const persistedState = upDown.getPersistedSnapshot();

      updateHistory(persistedState);
    },
    complete() {
      console.log('---complete');
    },
    error(state) {
      console.log('---error', state);
    }
  });
  return upDown;
}

// A service will fail
let provisionMaschine = await provisionFactory(createActors(1));

console.log('Expected to fail, second service is not available');

async function builtIt(retry = false) {
  console.log(`        ${retry ? 'Resuming failed step' : 'Building it up'}`);
  provisionMaschine.start();
  // Clean out whatever we had between runs
  if (!retry) {
    await fs.writeFile(FILENAME, JSON.stringify([]));
  }
  provisionMaschine.send({ type: 'UP' });

  await delay(PROVISION_TIMEOUT);

  provisionMaschine.stop();
}

await builtIt();

// Back to normal
console.log('a little later, back to normal. Pick up where we left');

provisionMaschine = await provisionFactory(createActors(0), true);

await builtIt(true);
