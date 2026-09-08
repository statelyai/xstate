import { createMachine, createAsyncLogic } from 'xstate';
import { getGreeting } from './getGreeting';
import { z } from 'zod';

export const fetchMachine = createMachine({
  schemas: {
    context: z.object({
      name: z.string(),
      data: z.object({ greeting: z.string() }).nullable()
    }),
    events: { FETCH: z.object({}), RETRY: z.object({}) }
  },
  actors: {
    fetchUser: createAsyncLogic({
      schemas: { input: z.object({ name: z.string() }) },
      run: ({ input }) => getGreeting(input.name)
    })
  },
  initial: 'idle',
  context: { name: 'World', data: null },
  states: {
    idle: { on: { FETCH: { target: 'loading' } } },
    loading: {
      invoke: {
        src: 'fetchUser',
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
      after: { 1000: { target: 'loading' } },
      on: { RETRY: { target: 'loading' } }
    }
  }
});
