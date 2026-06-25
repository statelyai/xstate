import { createMachine, createAsyncLogic } from 'xstate';
import { getGreeting } from '.';
import { z } from 'zod';
export const fetchMachine = createMachine({
  types: {
    context: {} as {
      name: string;
      data: {
        greeting: string;
      } | null;
    }
  },
  actorSources: {
    fetchUser: createAsyncLogic({
      schemas: {
        input: z.custom<{
          name: string;
        }>()
      },
      run: ({ input }) => getGreeting(input.name)
    })
  },
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
        onDone: ({ context, event, guards, actions }, enq) => {
          return {
            target: 'success',
            context: {
              ...context,
              data: (({ event }) => event.output)({
                context: context,
                event: event
              })
            }
          };
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
