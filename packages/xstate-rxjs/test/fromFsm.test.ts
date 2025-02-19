import { assign, createMachine } from '@xstate/fsm';
import { fromMachine } from '../src/fsm';

const onFetch = () => {
  return new Promise((res) => setTimeout(() => res('some data'), 50));
};

const fetchMachine = createMachine<{ data: string | undefined }, any>({
  id: 'fetch',
  initial: 'idle',
  context: { data: undefined },
  states: {
    idle: {
      on: { FETCH: 'loading' }
    },
    loading: {
      entry: 'load',
      on: {
        RESOLVE: {
          target: 'success',
          actions: assign({
            data: (_, e) => e.data
          }),
          cond: (_, e) => e.data.length
        }
      }
    },
    success: {}
  }
});

describe('fromMachine function for fsm', () => {
  it('should work', (done) => {
    const { state$, send } = fromMachine(fetchMachine, {
      actions: {
        load: () => {
          onFetch().then((res) => {
            send({ type: 'RESOLVE', data: res });
          });
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
});
