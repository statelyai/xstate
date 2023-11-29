import { fireEvent, render } from '@testing-library/vue';
import UseSelector from './UseSelector.vue';
import useSelectorActorChange from './UseSelectorActorChange.vue';
import useSelectorCustomFn from './UseSelectorCustomFn.vue';
import UseSelectorWithTransitionLogic from './UseSelectorWithTransitionLogic.vue';

describe('useSelector', () => {
  it('actor should provide snapshot value immediately', () => {
    const { getByTestId } = render(UseSelectorWithTransitionLogic);

    expect(getByTestId('selected').textContent).toEqual('42');
  });

  it('only rerenders for selected values', async () => {
    const { getByTestId, emitted } = render(UseSelector);

    const countButton = getByTestId('count');
    const otherButton = getByTestId('other');
    const incrementEl = getByTestId('increment');

    await fireEvent.click(incrementEl);
    expect(countButton.textContent).toBe('1');

    await fireEvent.click(otherButton);
    await fireEvent.click(otherButton);
    await fireEvent.click(otherButton);
    await fireEvent.click(otherButton);

    await fireEvent.click(incrementEl);
    expect(countButton.textContent).toBe('2');

    expect((emitted() as any).rerender.length).toBe(3);
  });

  it('should work with a custom comparison function', async () => {
    const { getByTestId } = render(useSelectorCustomFn);

    const nameEl = getByTestId('name');
    const sendUpperButton = getByTestId('sendUpper');
    const sendOtherButton = getByTestId('sendOther');

    expect(nameEl.textContent).toEqual('david');

    await fireEvent.click(sendUpperButton);

    // unchanged due to comparison function
    expect(nameEl.textContent).toEqual('david');

    await fireEvent.click(sendOtherButton);

    expect(nameEl.textContent).toEqual('other');

    await fireEvent.click(sendUpperButton);

    expect(nameEl.textContent).toEqual('DAVID');
  });

  it('should render snapshot state when actor changes', async () => {
    const { getByTestId, container } = render(useSelectorActorChange);
    expect(container.textContent).toEqual('foo');

    await fireEvent.click(getByTestId('changeActor'));

    expect(container.textContent).toEqual('bar');
  });
});
