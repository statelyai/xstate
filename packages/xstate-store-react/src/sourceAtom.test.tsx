import { StrictMode } from 'react';
import { act, render, screen } from '@testing-library/react';
import { createAtom, createSourceAtom, useAtom } from './index.ts';

it('shares a source listener across React consumers and releases it on unmount', () => {
  let value = 1;
  const listeners = new Set<() => void>();
  const subscribe = vi.fn((notify: () => void) => {
    listeners.add(notify);
    return {
      unsubscribe() {
        listeners.delete(notify);
      }
    };
  });
  const source = createSourceAtom({ getSnapshot: () => value, subscribe });
  const derived = createAtom(() => source.get() * 2);
  function Direct() {
    return <span data-testid="direct">{useAtom(source)}</span>;
  }
  function Derived() {
    return <span data-testid="derived">{useAtom(derived)}</span>;
  }
  const view = render(
    <StrictMode>
      <Direct key="direct" />
      <Derived key="derived" />
    </StrictMode>
  );
  expect(listeners.size).toBe(1);
  expect(screen.getByTestId('direct').textContent).toBe('1');
  expect(screen.getByTestId('derived').textContent).toBe('2');
  const mounts = subscribe.mock.calls.length;
  act(() => {
    value = 2;
    for (const notify of listeners) {
      notify();
    }
  });
  expect(screen.getByTestId('direct').textContent).toBe('2');
  expect(screen.getByTestId('derived').textContent).toBe('4');
  view.rerender(
    <StrictMode>
      <Derived key="derived" />
    </StrictMode>
  );
  expect(listeners.size).toBe(1);
  expect(subscribe).toHaveBeenCalledTimes(mounts);
  view.unmount();
  expect(listeners.size).toBe(0);
});
