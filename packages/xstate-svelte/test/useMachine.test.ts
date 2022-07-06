import { render, fireEvent } from '@testing-library/svelte';
import UseMachine from './UseMachine.svelte';
import UseMachineNonPersistentSubcription from './UseMachineNonPersistentSubcription.svelte';
import { fetchMachine } from './fetchMachine';
import { doneInvoke } from 'xstate';

const persistedFetchState = fetchMachine.transition(
  'loading',
  doneInvoke('fetchData', 'persisted data')
);

const persistedFetchStateConfig = JSON.parse(
  JSON.stringify(persistedFetchState)
);

describe('useMachine function', () => {
  it('should work with a component', async () => {
    const { getByText, findByText, getByTestId } = render(UseMachine);
    const button = getByText('Fetch');
    await fireEvent.click(button);
    await findByText('Loading...');
    await findByText(/Success/);
    const dataEl = getByTestId('data');
    expect(dataEl.textContent).toBe('some data');
  });

  it('should work with a component with rehydrated state', async () => {
    const { findByText, getByTestId } = render(UseMachine, {
      persistedState: persistedFetchState
    });
    await findByText(/Success/);
    const dataEl = getByTestId('data');
    expect(dataEl.textContent).toBe('persisted data');
  });

  it('should work with a component with rehydrated state config', async () => {
    const { findByText, getByTestId } = render(UseMachine, {
      persistedState: persistedFetchStateConfig
    });
    await findByText(/Success/);
    const dataEl = getByTestId('data');
    expect(dataEl.textContent).toBe('persisted data');
  });

  it("should not stop the interpreter even if subscribers' count go temporarily to zero", async () => {
    const { findByText, getByTestId } = render(
      UseMachineNonPersistentSubcription
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
