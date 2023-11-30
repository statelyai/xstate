import { render } from '@testing-library/vue';
import UseActorWithInitiallyInvokedChild from './UseActorWithInitiallyInvokedChild.vue';

describe('useActor', () => {
  it('initial invoked actor should be immediately available', async () => {
    const { getByTestId } = render(UseActorWithInitiallyInvokedChild);

    const machineSnapshotEl = getByTestId('machine-snapshot');
    const actorSnapshotEl = getByTestId('actor-snapshot');

    expect(machineSnapshotEl.textContent).toBe('active');
    expect(actorSnapshotEl.textContent).toBe('active');
  });
});
