import { render, fireEvent } from '@testing-library/vue';
import UseActorRef from './UseActorRef2.vue';

describe('useActorRef', () => {
  it('should be able to create an actor ref from a behavior', async () => {
    const { getByTestId } = render(UseActorRef);
    const button = getByTestId('count');

    expect(button.textContent).toEqual('0');

    await fireEvent.click(button);

    expect(button.textContent).toEqual('1');
  });
});
