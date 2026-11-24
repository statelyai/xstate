// oxlint-disable-next-line typescript/ban-ts-comment
// @ts-nocheck: loaded under xstate@5 by the verify child; typechecked as v6 here.
import { assign, fromPromise, setup } from 'xstate';

export const machine = setup({
  actors: {
    fetchUser: fromPromise(async ({ input }) => {
      const response = await fetch(`https://example.com/users/${input.id}`);
      return response.json();
    })
  }
}).createMachine({
  id: 'fetch',
  initial: 'idle',
  context: { user: null, error: null },
  states: {
    idle: { on: { FETCH: 'loading' } },
    loading: {
      invoke: {
        id: 'user',
        src: 'fetchUser',
        input: () => ({ id: 1 }),
        onDone: {
          target: 'success',
          actions: assign({ user: ({ event }) => event.output })
        },
        onError: {
          target: 'failure',
          actions: assign({ error: ({ event }) => String(event.error) })
        }
      }
    },
    success: { on: { RESET: 'idle' } },
    failure: { on: { RETRY: 'loading' } }
  }
});
