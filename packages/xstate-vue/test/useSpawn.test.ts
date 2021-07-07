import { render, fireEvent } from '@testing-library/vue';
import UseSpawn from './UseSpawn.vue';

describe('useSpawn', () => {
  it('should be able to spawn an actor from a behavior', async () => {
    const { getByTestId } = render(UseSpawn);
    const button = getByTestId('count');

    expect(button.textContent).toEqual('0');

    await fireEvent.click(button);

    expect(button.textContent).toEqual('1');
  });
});
