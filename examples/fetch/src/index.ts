import { createActor } from 'xstate';
import { fetchMachine } from './fetchMachine';

const fetchActor = createActor(fetchMachine);
fetchActor.subscribe((state) => {
  console.log('Value:', state.value);
  console.log('Context:', state.context);
});
fetchActor.start();

fetchActor.send({ type: 'FETCH' });
