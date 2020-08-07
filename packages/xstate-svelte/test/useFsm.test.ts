import { render, fireEvent } from '@testing-library/svelte';
import UseFsm from './UseFsm.svelte';

describe('useFsm', () => {
  it('should work', async () => {
    const { getByText, getByTestId, findByText } = render(UseFsm);
    const button = getByText('Fetch');
    await fireEvent.click(button);
    await findByText('Loading...');
    await findByText(/Success/);
    const dataEl = getByTestId('data');
    expect(dataEl.textContent).toBe('some data');
  });
});
