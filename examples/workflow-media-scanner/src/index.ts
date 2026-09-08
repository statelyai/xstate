import { mediaScannerMachine } from './mediaScannerMachine';
import { createActor } from 'xstate';

const [basePath, destinationPath] = process.argv.slice(2);
if (!basePath || !destinationPath)
  throw new Error(
    'Usage: pnpm start <source-directory> <destination-directory>'
  );
const actor = createActor(mediaScannerMachine, {
  input: { basePath, destinationPath }
});
actor.subscribe({
  next(snapshot) {
    console.log(snapshot.value, snapshot.context);
    if (snapshot.matches('ReportingErrors')) process.exitCode = 1;
  },
  error(error) {
    console.error(error);
    process.exitCode = 1;
  }
});
actor.start();
actor.send({ type: 'START_SCAN' });
