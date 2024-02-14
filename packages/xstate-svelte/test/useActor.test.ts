import { fireEvent, render } from '@testing-library/svelte';
import { createActor, createMachine } from 'xstate';
import UseActor from './UseActor.svelte';
import UseActorNonPersistentSubscription from './UseActorNonPersistentSubscription.svelte';
import { fetchMachine } from './fetchMachine.ts';

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

const persistedFetchStateConfig = JSON.parse(
  JSON.stringify(persistedFetchState)
);

describe('useActor', () => {
  it('should work with a component', async () => {
    const { getByText, findByText, getByTestId } = render(UseActor);
    const button = getByText('Fetch');
    await fireEvent.click(button);
    await findByText('Loading...');
    await findByText(/Success/);
    const dataEl = getByTestId('data');
    expect(dataEl.textContent).toBe('some data');
  });

  it('should work with a component with rehydrated state', async () => {
    const { findByText, getByTestId } = render(UseActor, {
      persistedState: persistedFetchState
    });
    await findByText(/Success/);
    const dataEl = getByTestId('data');
    expect(dataEl.textContent).toBe('persisted data');
  });

  it('should work with a component with rehydrated state config', async () => {
    const { findByText, getByTestId } = render(UseActor, {
      persistedState: persistedFetchStateConfig
    });
    await findByText(/Success/);
    const dataEl = getByTestId('data');
    expect(dataEl.textContent).toBe('persisted data');
  });

  it("should not stop the interpreter even if subscribers' count go temporarily to zero", async () => {
    const { findByText, getByTestId } = render(
      UseActorNonPersistentSubscription
    );
    let incButton = await findByText(/Increment/);

    await fireEvent.click(incButton);
    await fireEvent.click(incButton);
    await fireEvent.click(incButton);

    expect(getByTestId('count').textContent).toBe('3');

    const toggleButton = await findByText(/Toggle/);

    await fireEvent.click(toggleButton);
    await fireEvent.click(toggleButton);

    incButton = await findByText(/Increment/);

    await fireEvent.click(incButton);

    expect(getByTestId('count').textContent).toBe('4');
  });
});
