import { createMachine, createAsyncLogic } from 'xstate';

const context = {
  data: undefined as string | undefined
};

export const fetchMachine = createMachine({
  id: 'fetch',
  actorSources: {
    fetchData: createAsyncLogic({ run: () => Promise.resolve('') })
  },
  initial: 'idle',
  context,
  states: {
    idle: {
      on: { FETCH: { target: 'loading' } }
    },
    loading: {
      invoke: {
        id: 'fetchData',
        src: ({ actorSources }) => actorSources.fetchData,
        onDone: ({ event }) => {
          if (event.output.length > 0) {
            return {
              target: 'success',
              context: { data: event.output }
            };
          }
        }
      }
    },
    success: {
      type: 'final'
    }
  }
});
