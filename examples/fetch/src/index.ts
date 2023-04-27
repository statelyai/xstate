import { createMachine, interpret } from 'xstate';

const fetchMachine = createMachine({
  initial: 'idle',
  states: {
    idle: {
      on: {
        FETCH: 'loading'
      }
    },
    loading: {}
  }
});

const fetchActor = interpret(fetchMachine);
fetchActor.subscribe((state) => {
  console.log(state);
});
fetchActor.start();

fetchActor.send({ type: 'FETCH' });
