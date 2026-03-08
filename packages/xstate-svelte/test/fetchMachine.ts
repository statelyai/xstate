import { createMachine, fromPromise } from 'xstate';

const context = {
  data: undefined as string | undefined
};

export const fetchMachine = createMachine({
  id: 'fetch',
  actors: {
    fetchData: fromPromise(async () => '')
  },
  initial: 'idle',
  context: context as any,
  states: {
    idle: {
      on: { FETCH: 'loading' }
    },
    loading: {
      invoke: {
        id: 'fetchData',
        src: ({ actors }) => actors.fetchData,
        onDone: ({ event }) => {
          if ((event.output as string).length > 0) {
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
