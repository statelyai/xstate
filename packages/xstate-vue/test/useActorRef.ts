import { render, fireEvent } from '@testing-library/vue';
import UseActorRef2 from './UseActorRef2.vue';

describe('useActorRef', () => {
  it('should be able to spawn an actor from actor logic', async () => {
    const { getByTestId } = render(UseActorRef2);
    const button = getByTestId('count');

    expect(button.textContent).toEqual('0');

    await fireEvent.click(button);

    expect(button.textContent).toEqual('1');
  });
});
