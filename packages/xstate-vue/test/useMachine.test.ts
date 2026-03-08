import { fireEvent, render, waitFor } from '@testing-library/vue';
import {
  PromiseActorLogic,
  createActor,
  next_createMachine as createMachine
} from 'xstate';
import UseMachineNoExtraOptions from './UseMachine-no-extra-options.vue';
import UseMachine from './UseMachine.vue';

describe('useMachine', () => {
  const context = {
    data: undefined
  };
  const fetchMachine = createMachine({
    id: 'fetch',
    types: {} as {
      actors: {
        src: 'fetchData';
        logic: PromiseActorLogic<string>;
      };
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
          src: 'fetchData',
          onDone: {
            target: 'success',
            actions: ({ context, event }: any) => ({
              ...context,
              data: event.output
            }),
            guard: ({ event }: any) => !!event.output.length
          }
        } as any
      },
      success: {
        type: 'final'
      }
    }
  });

  const actorRef = createActor(
    fetchMachine.provide({
      actors: {
        fetchData: createMachine({
          initial: 'done',
          states: {
            done: {
              type: 'final'
            }
          },
          output: 'persisted data'
        }) as any
      }
    })
  ).start();
  actorRef.send({ type: 'FETCH' });

  const persistedFetchState = actorRef.getPersistedSnapshot();

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
