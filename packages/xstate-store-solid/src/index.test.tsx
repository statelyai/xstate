/* @jsxImportSource solid-js */
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { createStore, createAtom, useSelector } from './index';

describe('@xstate/store-solid', () => {
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
            {count()}
          </div>
        );
      };

      render(() => <Counter />);

      const countDiv = await screen.findByTestId('count');
      expect(countDiv.textContent).toEqual('0');

      fireEvent.click(countDiv);
      expect(countDiv.textContent).toEqual('1');
    });

    it('should batch updates', async () => {
      const store = createStore({
        context: { count: 0 },
        on: {
          inc: (ctx) => ({ ...ctx, count: ctx.count + 1 })
        }
      });

      const Counter = () => {
        const count = useSelector(store, (s) => s.context.count);
        return (
          <div
            data-testid="count"
            onClick={() => {
              store.send({ type: 'inc' });
              store.send({ type: 'inc' });
            }}
          >
            {count()}
          </div>
        );
      };

      render(() => <Counter />);

      const countDiv = await screen.findByTestId('count');
      expect(countDiv.textContent).toEqual('0');

      fireEvent.click(countDiv);
      expect(countDiv.textContent).toEqual('2');
    });

    it('should work with custom comparison function', async () => {
      const store = createStore({
        context: { items: [1, 2] },
        on: {
          same: (ctx) => ({ ...ctx, items: [1, 2] }),
          different: (ctx) => ({ ...ctx, items: [3, 4] })
        }
      });

      const Items = () => {
        const items = useSelector(
          store,
          (s) => s.context.items,
          (a, b) => JSON.stringify(a) === JSON.stringify(b)
        );
        return <div data-testid="items">{items().join(',')}</div>;
      };

      render(() => <Items />);

      const itemsDiv = await screen.findByTestId('items');
      expect(itemsDiv.textContent).toBe('1,2');

      store.send({ type: 'different' });
      expect(itemsDiv.textContent).toBe('3,4');
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
