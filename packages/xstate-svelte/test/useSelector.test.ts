import { render, fireEvent } from '@testing-library/svelte';
import UseSelector from './UseSelector.svelte';
import UseSelectorCustomFn from './UseSelectorCustomFn.svelte';
import UseSelectorDeferredSubscription from './UseSelectorDeferredSubscription.svelte';

describe('useSelector', () => {
  it('only reassigns when selected values change', async () => {
    const { getByTestId } = render(UseSelector);
    const countBtn = getByTestId('count');
    const anotherBtn = getByTestId('another');
    const withSelector = getByTestId('withSelector');
    const withoutSelector = getByTestId('withoutSelector');

    expect(withSelector.textContent).toBe('0');
    expect(withoutSelector.textContent).toBe('0');

    await fireEvent.click(countBtn);
    expect(withSelector.textContent).toBe('1');
    expect(withoutSelector.textContent).toBe('1');

    await fireEvent.click(anotherBtn);
    expect(withSelector.textContent).toBe('1');
    expect(withoutSelector.textContent).toBe('2');
  });

  it('should work with a custom comparison function', async () => {
    const { getByTestId } = render(UseSelectorCustomFn);

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

  // This test makes sure, that the Svelte store returned by `useSelector` will
  // provide an up to date value, when the state has changed between creating
  // the store (with `useSelector`) and subscribing to it.
  it('should have an updated value when the store is subscribed to after the state changed', async () => {
    const { getByTestId } = render(UseSelectorDeferredSubscription);

    const countBtn = getByTestId('count');
    const selectorOutput = getByTestId('selectorOutput');

    expect(selectorOutput.textContent).toEqual('0');

    await fireEvent.click(countBtn);
    await fireEvent.click(countBtn);

    expect(selectorOutput.textContent).toEqual('2');
  });
});
