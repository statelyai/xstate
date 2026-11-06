import { fireEvent, render, waitFor } from '@testing-library/vue';
import UseActorRefWithObserver from './UseActorRefWithObserver.vue';
import UseActorRefWithCustomLogic from './UseActorRefWithCustomLogic.vue';
import { defineComponent, h } from 'vue';
import { createActor, createMachine } from 'xstate';
import { restoreActor } from 'xstate/persist';
import { useActor } from '../src/index.ts';

describe('useActorRef', () => {
  it('uses a ready actor as is, starting it on mount and stopping it on unmount', () => {
    const machine = createMachine({
      initial: 'a',
      states: { a: { on: { NEXT: { target: 'b' } } }, b: {} }
    });
    const source = createActor(machine).start();
    source.send({ type: 'NEXT' });
    const actor = restoreActor(machine, source.getPersistedSnapshot());
    source.stop();
    let received: unknown;

    const Component = defineComponent({
      setup() {
        const { snapshot, actorRef } = useActor(actor);
        received = actorRef;
        return () =>
          h('div', { 'data-testid': 'value' }, String(snapshot.value.value));
      }
    });

    const { getByTestId, unmount } = render(Component);
    expect(received).toBe(actor);
    expect(getByTestId('value').textContent).toBe('b');
    expect(actor.getSnapshot().status).toBe('active');

    unmount();
    expect(actor.getSnapshot().status).toBe('stopped');
  });

  it('should be able to spawn an actor from actor logic', async () => {
    const { getByTestId } = render(UseActorRefWithCustomLogic);
    const button = getByTestId('count');

    expect(button.textContent).toEqual('0');

    await fireEvent.click(button);

    expect(button.textContent).toEqual('1');
  });

  it('observer should be called with next state', async () => {
    const { getByTestId } = render(UseActorRefWithObserver);

    const buttonEl = getByTestId('button');

    await waitFor(() => expect(buttonEl.textContent).toBe('Turn on'));
    await fireEvent.click(buttonEl);
    await waitFor(() => expect(buttonEl.textContent).toBe('Turn off'));
  });
});
