import { fireEvent, render, waitFor } from '@testing-library/vue';
import UseActorRefWithObserver from './UseActorRefWithObserver.vue';
import UseActorRefWithTransitionLogic from './UseActorRefWithTransitionLogic.vue';

describe('useActorRef', () => {
  it('should be able to spawn an actor from actor logic', async () => {
    const { getByTestId } = render(UseActorRefWithTransitionLogic);
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
