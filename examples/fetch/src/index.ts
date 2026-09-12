import { createActor } from 'xstate';
import { createInspector } from '@statelyai/sdk';
import { fetchMachine } from './fetchMachine';

const inspector = createInspector();

const fetchActor = createActor(fetchMachine, { inspect: inspector.inspect });

fetchActor.subscribe((snapshot) => {
  console.log('Value:', snapshot.value);
  console.log('Context:', snapshot.context);
});

fetchActor.start();

fetchActor.send({ type: 'FETCH' });
