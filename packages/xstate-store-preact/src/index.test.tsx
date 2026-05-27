/** @jsxImportSource preact */
import { fireEvent, render, screen, waitFor } from '@testing-library/preact';
import {
  createStore,
  createStoreLogic,
  createAtom,
  createAtomConfig,
  useSelector,
  useStore,
  useAtom,
  useAtomState
} from './index.ts';

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

  describe('useStore', () => {
    it('should create a stable store from store logic and input', () => {
      const counterLogic = createStoreLogic({
        context: (input: { initialCount: number }) => ({
          count: input.initialCount
        }),
        on: {
          inc: (ctx) => ({ count: ctx.count + 1 })
        }
      });
      let storeRefs: object[] = [];

      const Counter = () => {
        const store = useStore(counterLogic, { initialCount: 10 });
        storeRefs.push(store);
        const count = useSelector(store, (s) => s.context.count);
        return (
          <div data-testid="count" onClick={() => store.trigger.inc()}>
            {count}
          </div>
        );
      };

      render(<Counter />);

      const countDiv = screen.getByTestId('count');
      expect(countDiv.textContent).toBe('10');
      fireEvent.click(countDiv);
      expect(countDiv.textContent).toBe('11');
      expect(storeRefs.every((ref) => ref === storeRefs[0])).toBe(true);
    });
  });

  describe('useAtomState', () => {
    it('should return the value and existing atom', () => {
      const atom = createAtom(0);
      const atomRefs: object[] = [];

      const Counter = () => {
        const [count, countAtom] = useAtomState(atom);
        atomRefs.push(countAtom);
        return (
          <div
            data-testid="count"
            onClick={() => countAtom.set((count) => count + 1)}
          >
            {count}
          </div>
        );
      };

      render(<Counter />);

      const countDiv = screen.getByTestId('count');
      expect(countDiv.textContent).toBe('0');
      fireEvent.click(countDiv);
      expect(countDiv.textContent).toBe('1');
      expect(atomRefs.every((ref) => ref === atom)).toBe(true);
    });

    it('should create a stable atom from atom config and input', () => {
      const config = createAtomConfig((input: { initialCount: number }) => {
        return input.initialCount;
      });
      const atomRefs: object[] = [];

      const Counter = () => {
        const [count, countAtom] = useAtomState(config, { initialCount: 10 });
        atomRefs.push(countAtom);
        return (
          <div
            data-testid="count"
            onClick={() => countAtom.set((count) => count + 1)}
          >
            {count}
          </div>
        );
      };

      render(<Counter />);

      const countDiv = screen.getByTestId('count');
      expect(countDiv.textContent).toBe('10');
      fireEvent.click(countDiv);
      expect(countDiv.textContent).toBe('11');
      expect(atomRefs.every((ref) => ref === atomRefs[0])).toBe(true);
    });
  });

  describe('useAtom', () => {
    it('should create an atom value from atom config and input', () => {
      const config = createAtomConfig((input: { initialCount: number }) => {
        return input.initialCount;
      });

      const Counter = () => {
        const count = useAtom(config, { initialCount: 10 });
        return <div data-testid="count">{count}</div>;
      };

      render(<Counter />);
      expect(screen.getByTestId('count').textContent).toBe('10');
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
