import { fireEvent, screen, render, act } from '@testing-library/react';
import {
  createStore,
  createAtom,
  useSelector,
  useStore,
  useAtom,
  createStoreHook
} from './index';

describe('@xstate/store-react', () => {
  describe('useSelector', () => {
    it('should work with a selector', () => {
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

    it('should work with atoms', () => {
      const atom = createAtom(0);

      const Counter = () => {
        const count = useSelector(atom, (s) => s);
        return (
          <div data-testid="count" onClick={() => atom.set((prev) => prev + 1)}>
            {count}
          </div>
        );
      };

      render(<Counter />);

      expect(screen.getByTestId('count').textContent).toEqual('0');
      fireEvent.click(screen.getByTestId('count'));
      expect(screen.getByTestId('count').textContent).toEqual('1');
    });
  });

  describe('useStore', () => {
    it('should create a stable store reference', () => {
      let storeRefs: any[] = [];

      const Counter = () => {
        const store = useStore({
          context: { count: 0 },
          on: {
            inc: (ctx) => ({ ...ctx, count: ctx.count + 1 })
          }
        });

        storeRefs.push(store);
        const count = useSelector(store, (s) => s.context.count);

        return (
          <div data-testid="count" onClick={() => store.send({ type: 'inc' })}>
            {count}
          </div>
        );
      };

      render(<Counter />);
      const countDiv = screen.getByTestId('count');

      expect(countDiv.textContent).toBe('0');
      fireEvent.click(countDiv);
      expect(countDiv.textContent).toBe('1');
      expect(storeRefs.every((ref) => ref === storeRefs[0])).toBe(true);
    });
  });

  describe('useAtom', () => {
    it('should return the atom value', () => {
      const atom = createAtom(42);

      const TestComponent = () => {
        const value = useAtom(atom);
        return <div data-testid="value">{value}</div>;
      };

      render(<TestComponent />);
      expect(screen.getByTestId('value').textContent).toBe('42');
    });

    it('should update when atom changes', () => {
      const atom = createAtom(0);

      const TestComponent = () => {
        const count = useAtom(atom);
        return (
          <div>
            <div data-testid="count">{count}</div>
            <button
              data-testid="increment"
              onClick={() => atom.set((c) => c + 1)}
            >
              +
            </button>
          </div>
        );
      };

      render(<TestComponent />);
      expect(screen.getByTestId('count').textContent).toBe('0');

      act(() => {
        fireEvent.click(screen.getByTestId('increment'));
      });
      expect(screen.getByTestId('count').textContent).toBe('1');
    });
  });

  describe('createStoreHook', () => {
    it('should create a reusable store hook', () => {
      const useCountStore = createStoreHook({
        context: { count: 0 },
        on: {
          inc: (ctx) => ({ ...ctx, count: ctx.count + 1 })
        }
      });

      const Counter = () => {
        const [count, store] = useCountStore((s) => s.context.count);
        return (
          <div>
            <div data-testid="count">{count}</div>
            <button onClick={() => store.trigger.inc()}>+</button>
          </div>
        );
      };

      render(<Counter />);
      expect(screen.getByTestId('count').textContent).toBe('0');

      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByTestId('count').textContent).toBe('1');
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
