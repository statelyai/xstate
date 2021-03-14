import { render, fireEvent } from '@testing-library/vue';
import UseInterpret from './UseInterpret.vue';

describe('useInterpret composable function', () => {
  it('observer should be called with initial state', async () => {
    const { getByTestId } = render(UseInterpret);

    const buttonEl = getByTestId('button');

    expect(buttonEl.textContent).toBe('Turn on');
  });

  it('observer should be called with next state', async () => {
    const { getByTestId } = render(UseInterpret);

    const buttonEl = getByTestId('button');

    expect(buttonEl.textContent).toBe('Turn on');
    await fireEvent.click(buttonEl);
    expect(buttonEl.textContent).toBe('Turn off');
  });
});
