import { fireEvent, render } from '@testing-library/vue';
import UseActorWithInitiallyInvokedChild from './UseActorWithInitiallyInvokedChild.vue';
import UseActorWithTransitionLogic from './UseActorWithTransitionLogic.vue';

describe('useActor', () => {
  it('initial invoked actor should be immediately available', async () => {
    const { getByTestId } = render(UseActorWithInitiallyInvokedChild);

    const machineSnapshotEl = getByTestId('machine-snapshot');
    const actorSnapshotEl = getByTestId('actor-snapshot');

    expect(machineSnapshotEl.textContent).toBe('active');
    expect(actorSnapshotEl.textContent).toBe('active');
  });

  it('should be able to spawn an actor from actor logic', async () => {
    const { getByTestId } = render(UseActorWithTransitionLogic);
    const button = getByTestId('count');

    expect(button.textContent).toEqual('0');

    await fireEvent.click(button);

    expect(button.textContent).toEqual('1');
  });
});
