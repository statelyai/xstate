import { render, fireEvent, waitFor } from '@testing-library/vue';
import UseInterpret from './UseInterpret.vue';

describe('useInterpret composable function', () => {
  it('observer should be called with initial state', async () => {
    const { getByTestId } = render(UseInterpret);

    const buttonEl = getByTestId('button');
    await waitFor(() => expect(buttonEl.textContent).toBe('Turn on'));
  });

  it('observer should be called with next state', async () => {
    const { getByTestId } = render(UseInterpret);

    const buttonEl = getByTestId('button');

    await waitFor(() => expect(buttonEl.textContent).toBe('Turn on'));
    await fireEvent.click(buttonEl);
    await waitFor(() => expect(buttonEl.textContent).toBe('Turn off'));
  });
});
