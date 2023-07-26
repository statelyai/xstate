import { render, fireEvent, waitFor } from '@testing-library/vue';
import UseMachine from './UseMachine.vue';
import UseMachineNoExtraOptions from './UseMachine-no-extra-options.vue';
import {
  createMachine,
  assign,
  doneInvoke,
  interpret,
  fromCallback
} from 'xstate';
import { CallbackActorLogic } from 'xstate/actors';

describe('useMachine composition function', () => {
  const context = {
    data: undefined
  };
  const fetchMachine = createMachine({
    id: 'fetch',
    types: {} as {
      actors: {
        src: 'fetchData';
        logic: CallbackActorLogic<any>;
      };
    },
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
              data: ({ event }) => event.output
            }),
            guard: ({ event }) => !!event.output.length
          }
        }
      },
      success: {
        type: 'final'
      }
    }
  });

  const actorRef = interpret(
    fetchMachine.provide({
      actors: {
        fetchData: fromCallback(({ sendBack }) => {
          sendBack(doneInvoke('fetchData', 'persisted data'));
        })
      }
    })
  ).start();
  actorRef.send({ type: 'FETCH' });

  const persistedFetchState = actorRef.getPersistedState();

  it('should work with a component ', async () => {
    const { getByText, getByTestId } = render(UseMachine as any);
    const button = getByText('Fetch');
    fireEvent.click(button);
    await waitFor(() => getByText('Loading...'));
    await waitFor(() => getByText(/Success/));
    const dataEl = getByTestId('data');
    expect(dataEl.textContent).toBe('some data');
  });

  it('should work with a component with rehydrated state', async () => {
    const { getByText, getByTestId } = render(UseMachine as any, {
      props: { persistedState: persistedFetchState }
    });
    await waitFor(() => getByText(/Success/));
    const dataEl = getByTestId('data');

    expect(dataEl.textContent).toBe('persisted data');
  });

  it('should work with a component with rehydrated state config', async () => {
    const persistedFetchStateConfig = JSON.parse(
      JSON.stringify(persistedFetchState)
    );
    const { getByText, getByTestId } = render(UseMachine as any, {
      props: { persistedState: persistedFetchStateConfig }
    });
    await waitFor(() => getByText(/Success/));
    const dataEl = getByTestId('data');
    expect(dataEl.textContent).toBe('persisted data');
  });

  it('should not crash without optional `options` parameter being provided', async () => {
    expect(() => {
      render(UseMachineNoExtraOptions as any);
    }).not.toThrow();
  });
});
