import { render, fireEvent, waitFor } from '@testing-library/vue';
import UseMachineWithSelector from './UseMachineWithSelector.vue';
import UseSelectorCustomActor from './UseSelectorCustomActor.vue';
import UseSelectorWithCustomActor2 from './UseSelectorWithCustomActor2.vue';
import UseSelectorWithPropActor from './UseSelectorWithPropActor.vue';

import { createMachine, createActor, sendParent } from 'xstate';

describe('useActor composable function', () => {
  it('initial invoked actor should be immediately available', async () => {
    const { getByTestId } = render(UseMachineWithSelector);

    const machineStateEl = getByTestId('machine-state');
    const actorStateEl = getByTestId('actor-state');

    expect(machineStateEl.textContent).toBe('active');
    expect(actorStateEl.textContent).toBe('active');
  });

  it('invoked actor in a standalone component should be able to receive events', async () => {
    const childMachine = createMachine({
      id: 'childMachine',
      initial: 'active',
      states: {
        active: {
          on: {
            FINISH: { actions: sendParent({ type: 'FINISH' }) }
          }
        }
      }
    });
    const machine = createMachine({
      initial: 'active',
      invoke: {
        id: 'child',
        src: childMachine
      },
      states: {
        active: {
          on: { FINISH: 'success' }
        },
        success: {}
      }
    });

    const serviceMachine = createActor(machine).start();

    const { getByTestId } = render(UseSelectorWithPropActor, {
      props: { actor: serviceMachine.getSnapshot().children.child }
    });

    const actorStateEl = getByTestId('actor-state');
    expect(actorStateEl.textContent).toBe('active');

    await waitFor(() =>
      expect(serviceMachine.getSnapshot().value).toBe('success')
    );
  });

  it('actor should provide snapshot value immediately', () => {
    const { getByTestId } = render(UseSelectorCustomActor);

    const stateEl = getByTestId('state');
    expect(stateEl.textContent).toEqual('42');
  });

  it('should update snapshot value when actor changes', async () => {
    const { getByTestId } = render(UseSelectorWithCustomActor2);

    const stateEl = getByTestId('state');
    const button = getByTestId('button');

    expect(stateEl.textContent).toEqual('42');
    await fireEvent.click(button);
    expect(stateEl.textContent).toEqual('100');
  });
});
