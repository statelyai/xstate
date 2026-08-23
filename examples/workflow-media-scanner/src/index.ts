import { createActor } from 'xstate';
import { mediaScannerMachine } from './mediaScannerMachine';
import { createInspector } from '@statelyai/sdk';

const inspector = process.env.INSPECT ? createInspector() : undefined;

const basePath = process.env.MEDIA_BASE_PATH;
const destinationPath = process.env.MEDIA_DESTINATION_PATH;

if (!basePath || !destinationPath) {
  console.error(
    'Set MEDIA_BASE_PATH and MEDIA_DESTINATION_PATH before running the scanner.'
  );
  process.exit(1);
}

const mediaScannerActor = createActor(mediaScannerMachine, {
  input: { basePath, destinationPath },
  inspect: inspector?.inspect
});

mediaScannerActor.subscribe((snapshot) => {
  console.log({ state: snapshot.value, context: snapshot.context });
});

mediaScannerActor.start();
mediaScannerActor.send({ type: 'START_SCAN' });
