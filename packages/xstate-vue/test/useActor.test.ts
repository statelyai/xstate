import { render, fireEvent } from '@testing-library/vue';
import UseActor from './UseActor.vue';
import UseActorSimple from './UseActorSimple.vue';
import UseActorCreateSimple from './UseActorCreateSimple.vue';

describe('useActor composable function', () => {
  it('initial invoked actor should be immediately available', async () => {
    const { getByTestId } = render(UseActor);

    const machineStateEl = getByTestId('machine-state');
    const actorStateEl = getByTestId('actor-state');

    expect(machineStateEl.textContent).toBe('active');
    expect(actorStateEl.textContent).toBe('active');
  });

  it('actor should provide snapshot value immediately', () => {
    const { getByTestId } = render(UseActorSimple);

    const stateEl = getByTestId('state');
    expect(stateEl.textContent).toEqual('42');
  });

  it('should update snapshot value when actor changes', async () => {
    const { getByTestId } = render(UseActorCreateSimple);

    const stateEl = getByTestId('state');
    const button = getByTestId('button');

    expect(stateEl.textContent).toEqual('42');
    await fireEvent.click(button);
    expect(stateEl.textContent).toEqual('100');
  });
});
