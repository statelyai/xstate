import { assign, createActor, fromPromise, setup } from 'xstate';

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

const fetchMachine = setup({
  types: {
    context: {} as {
      name: string;
      data: {
        greeting: string;
      } | null;
    }
  },
  actors: {
    fetchUser: fromPromise(({ input }: { input: { name: string } }) =>
      getGreeting(input.name)
    )
  }
}).createMachine({
  initial: 'idle',
  context: {
    name: 'World',
    data: null
  },
  states: {
    idle: {
      on: {
        FETCH: 'loading'
      }
    },
    loading: {
      invoke: {
        src: 'fetchUser',
        input: ({ context }) => ({ name: context.name }),
        onDone: {
          target: 'success',
          actions: assign({
            data: ({ event }) => event.output
          })
        },
        onError: 'failure'
      }
    },
    success: {},
    failure: {
      after: {
        1000: 'loading'
      },
      on: {
        RETRY: 'loading'
      }
    }
  }
});

const fetchActor = createActor(fetchMachine);
fetchActor.subscribe((state) => {
  console.log('Value:', state.value);
  console.log('Context:', state.context);
});
fetchActor.start();

fetchActor.send({ type: 'FETCH' });
