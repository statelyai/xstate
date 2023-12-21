import { mediaScannerMachine } from './mediaScannerMachine';
import { createActor } from 'xstate';

(async () => {
  console.log('Starting the awesome media scanner thingy');

  const mediaScannerActor = createActor(mediaScannerMachine, {
    input: {
      basePath: 'YOUR BASE PATH HERE',
      destinationPath: 'YOUR DESTINATION PATH HERE'
    }
  });

  mediaScannerActor.subscribe((state) => {
    console.log({
      state: state.value,
      error: state.error,
      context: state.context
    });
  });

  mediaScannerActor.start();
  mediaScannerActor.send({ type: 'START_SCAN' });
})();
