import { render, fireEvent, waitFor } from '@testing-library/vue';
import UseActorRef from './UseActorRef.vue';
import UseActorRef2 from './UseActorRef2.vue';

describe('useActorRef composable function', () => {
  it('should be able to create an actor ref from actor logic', async () => {
    const { getByTestId } = render(UseActorRef2);
    const button = getByTestId('count');

    expect(button.textContent).toEqual('0');

    await fireEvent.click(button);

    expect(button.textContent).toEqual('1');
  });

  it('observer should be called with next state', async () => {
    const { getByTestId } = render(UseActorRef);

    const buttonEl = getByTestId('button');

    await waitFor(() => expect(buttonEl.textContent).toBe('Turn on'));
    await fireEvent.click(buttonEl);
    await waitFor(() => expect(buttonEl.textContent).toBe('Turn off'));
  });
});
