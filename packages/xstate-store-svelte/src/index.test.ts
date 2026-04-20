import { createStore, createAtom, useSelector } from './index';

describe('@xstate/store-svelte', () => {
  describe('useSelector', () => {
    it('should create a Svelte-compatible readable store', () => {
      const store = createStore({
        context: { count: 0 },
        on: {
          inc: (ctx) => ({ ...ctx, count: ctx.count + 1 })
        }
      });

      const count$ = useSelector(store, (s) => s.context.count);

      let value: number | undefined;
      const unsubscribe = count$.subscribe((v) => {
        value = v;
      });

      expect(value).toBe(0);

      store.send({ type: 'inc' });
      expect(value).toBe(1);

      store.send({ type: 'inc' });
      expect(value).toBe(2);

      unsubscribe();
    });

    it('should use default selector when none provided', () => {
      const store = createStore({
        context: { count: 42 },
        on: {}
      });

      const snapshot$ = useSelector(store);

      let value: any;
      const unsubscribe = snapshot$.subscribe((v) => {
        value = v;
      });

      expect(value.context.count).toBe(42);
      unsubscribe();
    });

    it('should use custom comparison function', () => {
      const store = createStore({
        context: { items: [1, 2] },
        on: {
          same: (ctx) => ({ ...ctx, items: [1, 2] }),
          different: (ctx) => ({ ...ctx, items: [3, 4] })
        }
      });

      let updateCount = 0;
      const items$ = useSelector(
        store,
        (s) => s.context.items,
        (a, b) => JSON.stringify(a) === JSON.stringify(b)
      );

      const unsubscribe = items$.subscribe(() => {
        updateCount++;
      });

      expect(updateCount).toBe(1); // Initial

      store.send({ type: 'same' }); // Same content, should not trigger
      expect(updateCount).toBe(1);

      store.send({ type: 'different' }); // Different content
      expect(updateCount).toBe(2);

      unsubscribe();
    });

    it('should clean up subscription on unsubscribe', () => {
      const store = createStore({
        context: { count: 0 },
        on: {
          inc: (ctx) => ({ ...ctx, count: ctx.count + 1 })
        }
      });

      const count$ = useSelector(store, (s) => s.context.count);

      let value: number | undefined;
      const unsubscribe = count$.subscribe((v) => {
        value = v;
      });

      expect(value).toBe(0);
      store.send({ type: 'inc' });
      expect(value).toBe(1);

      unsubscribe();

      // After unsubscribe, value should not update
      store.send({ type: 'inc' });
      expect(value).toBe(1);
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
