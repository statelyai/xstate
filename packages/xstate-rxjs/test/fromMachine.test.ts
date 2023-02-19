import { assign, createMachine, doneInvoke } from 'xstate';
import { fromMachine } from '../src';

const fetchMachine = createMachine<{ data: string | undefined }>({
  predictableActionArguments: true,
  id: 'fetch',
  initial: 'idle',
  context: {
    data: undefined
  },
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
            data: (_, e) => e.data
          }),
          cond: (_, e) => e.data.length
        }
      }
    },
    success: {
      type: 'final'
    }
  }
});

const persistedFetchState = fetchMachine.transition(
  'loading',
  doneInvoke('fetchData', 'persisted data')
);

const persistedFetchStateConfig = JSON.parse(
  JSON.stringify(persistedFetchState)
);

describe('fromMachine function', () => {
  it('should work', (done) => {
    const { state$, send } = fromMachine(fetchMachine, {
      services: {
        fetchData: () => {
          return new Promise((res) => setTimeout(() => res('some data'), 50));
        }
      }
    });

    state$.subscribe((state) => {
      if (state.matches('success')) {
        expect(state.context.data).toBe('some data');
        done();
      }
    });

    send('FETCH');
  });

  it('should work with rehydrated state', (done) => {
    const { state$ } = fromMachine(fetchMachine, {
      state: persistedFetchState
    });

    state$.subscribe((state) => {
      if (state.matches('success')) {
        expect(state.context.data).toBe('persisted data');
        done();
      }
    });
  });

  it('should work with rehydrated state config', (done) => {
    const { state$ } = fromMachine(fetchMachine, {
      state: persistedFetchStateConfig
    });

    state$.subscribe((state) => {
      if (state.matches('success')) {
        expect(state.context.data).toBe('persisted data');
        done();
      }
    });
  });
});
