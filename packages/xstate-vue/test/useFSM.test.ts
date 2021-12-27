import { render, fireEvent, waitFor } from '@testing-library/vue';
import UseFSM from './UseFSM.vue';

describe('UseFSM composable function', () => {
  it('should work ', async () => {
    const { getByText, getByTestId } = render(UseFSM as any);
    const button = getByText('Fetch');
    fireEvent.click(button);
    await waitFor(() => getByText('Loading...'));
    await waitFor(() => getByText(/Success/));
    const dataEl = getByTestId('data');
    expect(dataEl.textContent).toBe('some data');
  });
});
