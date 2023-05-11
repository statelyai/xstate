import { render, fireEvent, waitFor } from '@testing-library/vue';
import UseActorRef from './UseActorRef.vue';

describe('useActorRef composable function', () => {
  it('observer should be called with next state', async () => {
    const { getByTestId } = render(UseActorRef);

    const buttonEl = getByTestId('button');

    await waitFor(() => expect(buttonEl.textContent).toBe('Turn on'));
    await fireEvent.click(buttonEl);
    await waitFor(() => expect(buttonEl.textContent).toBe('Turn off'));
  });
});
