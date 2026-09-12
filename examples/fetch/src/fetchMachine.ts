import { createAsyncLogic, setup, types } from 'xstate';
import { getGreeting } from './getGreeting';

export const fetchMachine = setup({
  schemas: {
    context: types<{
      name: string;
      data: { greeting: string } | null;
    }>(),
    events: {
      FETCH: types<{}>(),
      RETRY: types<{}>()
    }
  },
  actors: {
    fetchGreeting: createAsyncLogic({
      schemas: {
        input: types<{ name: string }>()
      },
      run: ({ input }) => getGreeting(input.name)
    })
  }
}).createMachine({
  id: 'fetch',
  initial: 'idle',
  context: {
    name: 'World',
    data: null
  },
  states: {
    idle: {
      on: {
        FETCH: { target: 'loading' }
      }
    },
    loading: {
      invoke: {
        src: 'fetchGreeting',
        input: ({ context }) => ({ name: context.name }),
        onDone: ({ context, event }) => ({
          target: 'success',
          context: { ...context, data: event.output }
        }),
        onError: { target: 'failure' }
      }
    },
    success: {},
    failure: {
      after: {
        1000: { target: 'loading' }
      },
      on: {
        RETRY: { target: 'loading' }
      }
    }
  }
});
