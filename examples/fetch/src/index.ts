import { createMachine, fromPromise, interpret } from 'xstate';

async function getGreeting(name: string): Promise<{ greeting: string }> {
  return new Promise((res, rej) => {
    setTimeout(() => {
      if (Math.random() < 0.5) {
        rej();
        return;
      }
      res({
        greeting: `Hello, ${name}!`
      });
    }, 1000);
  });
}

const fetchMachine = createMachine({
  initial: 'idle',
  states: {
    idle: {
      on: {
        FETCH: 'loading'
      }
    },
    loading: {
      invoke: {
        src: fromPromise(({ input }) => getGreeting(input.name)),
        input: ({ context }) => ({ name: context.name })
      }
    },
    success: {},
    failure: {
      on: {
        RETRY: 'loading'
      }
    }
  }
});

const fetchActor = interpret(fetchMachine);
fetchActor.subscribe((state) => {
  console.log(state);
});
fetchActor.start();

fetchActor.send({ type: 'FETCH' });
