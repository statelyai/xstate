import { createMachine, assign } from 'xstate';

const context = {
  data: undefined
};

export const fetchMachine = createMachine<typeof context, any>({
  id: 'fetch',
  initial: 'idle',
  context,
  states: {
    idle: {
      on: { FETCH: 'loading' }
    },
    loading: {
      invoke: {
        id: 'fetchData',
        src: 'fetchData',
        onDone: {
          target: 'success',
          actions: assign({
            data: (_, event) => event.data
          }),
          guard: ({ event }) => event.data.length
        }
      }
    },
    success: {
      type: 'final'
    }
  }
});
