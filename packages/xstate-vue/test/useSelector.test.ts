import { render, fireEvent, waitFor } from '@testing-library/vue';
import { createMachine, interpret, sendParent } from 'xstate';
import UseSelector from './UseSelector.vue';
import UseSelectorCustomFn from './UseSelectorCustomFn.vue';
import UseSelectorInitiallyInvokedChild from './UseSelectorInitiallyInvokedChild.vue';
import UseSelectorExternalActor from './UseSelectorExternalActor.vue';
import UseSelectorChangingActor from './UseSelectorChangingActor.vue';
import UseSelectorActorProp from './UseSelectorActorProp.vue';

describe('useSelector', () => {
  it('only rerenders for selected values', async () => {
    const { getByTestId, emitted } = render(UseSelector);

    const countButton = getByTestId('count');
    const otherButton = getByTestId('other');
    const incrementEl = getByTestId('increment');

    await fireEvent.click(incrementEl);
    expect(countButton.textContent).toBe('1');

    await fireEvent.click(otherButton);
    await fireEvent.click(otherButton);
    await fireEvent.click(otherButton);
    await fireEvent.click(otherButton);

    await fireEvent.click(incrementEl);
    expect(countButton.textContent).toBe('2');

    expect((emitted() as any).rerender.length).toBe(3);
  });

  it('should work with a custom comparison function', async () => {
    const { getByTestId } = render(UseSelectorCustomFn);

    const nameEl = getByTestId('name');
    const sendUpperButton = getByTestId('sendUpper');
    const sendOtherButton = getByTestId('sendOther');

    expect(nameEl.textContent).toEqual('david');

    await fireEvent.click(sendUpperButton);

    // unchanged due to comparison function
    expect(nameEl.textContent).toEqual('david');

    await fireEvent.click(sendOtherButton);

    expect(nameEl.textContent).toEqual('other');

    await fireEvent.click(sendUpperButton);

    expect(nameEl.textContent).toEqual('DAVID');
  });

  it('initial invoked actor should be immediately available', async () => {
    const { getByTestId } = render(UseSelectorInitiallyInvokedChild);

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

    const serviceMachine = interpret(machine).start();

    const { getByTestId } = render(UseSelectorActorProp, {
      props: { actor: serviceMachine.getSnapshot().children.child }
    });

    const actorStateEl = getByTestId('actor-state');
    expect(actorStateEl.textContent).toBe('active');

    await waitFor(() =>
      expect(serviceMachine.getSnapshot().value).toBe('success')
    );
  });

  it('actor should provide snapshot value immediately', () => {
    const { getByTestId } = render(UseSelectorExternalActor);

    const stateEl = getByTestId('state');
    expect(stateEl.textContent).toEqual('42');
  });

  it('should update snapshot value when actor changes', async () => {
    const { getByTestId } = render(UseSelectorChangingActor);

    const stateEl = getByTestId('state');
    const button = getByTestId('button');

    expect(stateEl.textContent).toEqual('42');
    await fireEvent.click(button);
    expect(stateEl.textContent).toEqual('100');
  });
});
