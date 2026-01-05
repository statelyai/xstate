/** @jsxImportSource preact */
import { fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { createStore, createAtom, useSelector } from './index';

describe('@xstate/store-preact', () => {
  describe('useSelector', () => {
    it('should work with a selector', async () => {
      const store = createStore({
        context: { count: 0 },
        on: {
          inc: (ctx) => ({ ...ctx, count: ctx.count + 1 })
        }
      });

      const Counter = () => {
        const count = useSelector(store, (s) => s.context.count);
        return (
          <div data-testid="count" onClick={() => store.send({ type: 'inc' })}>
            {count}
          </div>
        );
      };

      render(<Counter />);

      const countDiv = screen.getByTestId('count');
      expect(countDiv.textContent).toEqual('0');

      fireEvent.click(countDiv);
      expect(countDiv.textContent).toEqual('1');
    });

    it('should work without a selector (full snapshot)', () => {
      const store = createStore({
        context: { count: 0 },
        on: {}
      });

      const Counter = () => {
        const snapshot = useSelector(store);
        return <div data-testid="count">{snapshot.context.count}</div>;
      };

      render(<Counter />);
      expect(screen.getByTestId('count').textContent).toBe('0');
    });

    it('should use custom comparison function', async () => {
      const store = createStore({
        context: { items: [1, 2] },
        on: {
          same: (ctx) => ({ ...ctx, items: [1, 2] }),
          different: (ctx) => ({ ...ctx, items: [3, 4] })
        }
      });

      let renderCount = 0;
      const Items = () => {
        renderCount++;
        const items = useSelector(
          store,
          (s) => s.context.items,
          (a, b) => JSON.stringify(a) === JSON.stringify(b)
        );
        return <div data-testid="items">{items.join(',')}</div>;
      };

      render(<Items />);

      const itemsDiv = screen.getByTestId('items');
      expect(itemsDiv.textContent).toBe('1,2');
      expect(renderCount).toBe(1);

      store.send({ type: 'same' });
      // Allow effect to run
      await waitFor(() => {
        expect(renderCount).toBe(1); // No re-render due to custom compare
      });

      store.send({ type: 'different' });
      await waitFor(() => {
        expect(itemsDiv.textContent).toBe('3,4');
      });
      expect(renderCount).toBe(2);
    });
  });

  describe('re-exports', () => {
    it('should re-export createStore from @xstate/store', () => {
      expect(createStore).toBeDefined();
      const store = createStore({
        context: { value: 'test' },
        on: {}
      });
      expect(store.get().context.value).toBe('test');
    });

    it('should re-export createAtom from @xstate/store', () => {
      expect(createAtom).toBeDefined();
      const atom = createAtom(123);
      expect(atom.get()).toBe(123);
    });
  });
});
