import { createActor } from 'xstate';
import { createBrowserInspector } from '@statelyai/inspect';
import { fetchMachine } from './fetchMachine';

const inspector = createBrowserInspector();

const fetchActor = createActor(fetchMachine, { inspect: inspector.inspect });

fetchActor.subscribe((snapshot) => {
  console.log('Value:', snapshot.value);
  console.log('Context:', snapshot.context);
});

fetchActor.start();

fetchActor.send({ type: 'FETCH' });
