import { PersistedMachineState, interpret } from 'xstate';
import { promises as fs } from 'fs';
import { UpDownMaschine } from './machines';
import { actors, delay } from './actors';

const FILENAME = './historyStates.json';
const PROVISION_TIMEOUT = 30000;

let historyStates: PersistedMachineState<any>[] = [];
async function updateHistory(state: any) {
  try {
    historyStates = JSON.parse(await fs.readFile(FILENAME, 'utf8'));
  } catch (e) {
    console.log('No history states found.');
    historyStates = [];
  }
  historyStates = [...historyStates, state];
  fs.writeFile(FILENAME, JSON.stringify(historyStates));
}

async function provisionFactory() {
  const upDown = interpret(UpDownMaschine.provide({ actors }));
  upDown.subscribe({
    next(state) {
      console.log('---next', state.value);
      const persistedState = upDown.getPersistedState();
      updateHistory(persistedState);
      if (state.matches({ Up: 'Done' })) {
        console.log('        Step 2: Tearing it down after 30sec');
      }
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

let provisionMaschine = await provisionFactory();

async function doIt() {
  console.log('        Step 1: Building it up');
  provisionMaschine.start();
  // Clean out whatever we had between runs
  await fs.writeFile(FILENAME, JSON.stringify([]));
  provisionMaschine.send({ type: 'UP' });

  await delay(PROVISION_TIMEOUT);

  provisionMaschine.stop();

  // Create a new provisionMachine
  provisionMaschine.stop();
  provisionMaschine = await provisionFactory();
  provisionMaschine.send({ type: 'DOWN' });
  provisionMaschine.start();

  await delay(PROVISION_TIMEOUT);
  provisionMaschine.stop();

  console.log('        Step 3: Checkout historyStates.json');
}

await doIt();
