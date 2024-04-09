import { assign, fromPromise, setup } from 'xstate';
import { getGreeting } from '.';

export const fetchMachine = setup({
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
