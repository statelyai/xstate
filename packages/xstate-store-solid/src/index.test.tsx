/* @jsxImportSource solid-js */
import { fireEvent, render, screen } from '@solidjs/testing-library';
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

    it('should work with atoms', async () => {
      const atom = createAtom(0);

      const Counter = () => {
        const count = useSelector(atom, (value) => value);
        return (
          <div data-testid="count" onClick={() => atom.set((prev) => prev + 1)}>
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
  });

  describe('useStore', () => {
    it('should create a store from store logic and input', async () => {
      const counterLogic = createStoreLogic({
        context: (input: { initialCount: number }) => ({
          count: input.initialCount
        }),
        on: {
          inc: (ctx) => ({ count: ctx.count + 1 })
        }
      });

      const Counter = () => {
        const store = useStore(counterLogic, { initialCount: 10 });
        const count = useSelector(store, (s) => s.context.count);
        return (
          <div data-testid="count" onClick={() => store.trigger.inc()}>
            {count()}
          </div>
        );
      };

      render(() => <Counter />);

      const countDiv = await screen.findByTestId('count');
      expect(countDiv.textContent).toBe('10');
      fireEvent.click(countDiv);
      expect(countDiv.textContent).toBe('11');
    });
  });

  describe('useAtomState', () => {
    it('should return the value and existing atom', async () => {
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
            {count()}
          </div>
        );
      };

      render(() => <Counter />);

      const countDiv = await screen.findByTestId('count');
      expect(countDiv.textContent).toBe('0');
      fireEvent.click(countDiv);
      expect(countDiv.textContent).toBe('1');
      expect(atomRefs.every((ref) => ref === atom)).toBe(true);
    });

    it('should create an atom from atom config and input', async () => {
      const config = createAtomConfig((input: { initialCount: number }) => {
        return input.initialCount;
      });

      const Counter = () => {
        const [count, countAtom] = useAtomState(config, {
          initialCount: 10
        });
        return (
          <div
            data-testid="count"
            onClick={() => countAtom.set((count) => count + 1)}
          >
            {count()}
          </div>
        );
      };

      render(() => <Counter />);

      const countDiv = await screen.findByTestId('count');
      expect(countDiv.textContent).toBe('10');
      fireEvent.click(countDiv);
      expect(countDiv.textContent).toBe('11');
    });
  });

  describe('useAtom', () => {
    it('should create an atom value from atom config and input', async () => {
      const config = createAtomConfig((input: { initialCount: number }) => {
        return input.initialCount;
      });

      const Counter = () => {
        const count = useAtom(config, { initialCount: 10 });
        return <div data-testid="count">{count()}</div>;
      };

      render(() => <Counter />);

      const countDiv = await screen.findByTestId('count');
      expect(countDiv.textContent).toBe('10');
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
