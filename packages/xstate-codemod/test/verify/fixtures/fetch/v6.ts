import { createAsyncLogic, createMachine } from 'xstate';

const fetchUser = createAsyncLogic({
  run: async ({ input }: { input: { id: number } }) => {
    const response = await fetch(`https://example.com/users/${input.id}`);
    return response.json();
  }
});

export const machine = createMachine({
  id: 'fetch',
  actors: { fetchUser },
  initial: 'idle',
  context: { user: null as unknown, error: null as string | null },
  states: {
    idle: { on: { FETCH: { target: 'loading' } } },
    loading: {
      invoke: {
        id: 'user',
        src: 'fetchUser',
        input: () => ({ id: 1 }),
        onDone: ({ event }) => ({
          target: 'success',
          context: { user: event.output }
        }),
        onError: ({ event }) => ({
          target: 'failure',
          context: { error: String(event.error) }
        })
      }
    },
    success: { on: { RESET: { target: 'idle' } } },
    failure: { on: { RETRY: { target: 'loading' } } }
  }
});
