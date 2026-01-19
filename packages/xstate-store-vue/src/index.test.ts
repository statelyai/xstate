import { fireEvent, render } from '@testing-library/vue';
import TestCounter from './TestCounter.vue';
import { createStore, createAtom } from './index';

describe('@xstate/store-vue', () => {
  describe('useSelector', () => {
    it('should work with a selector', async () => {
      const { getByTestId } = render(TestCounter);

      const countEl = getByTestId('count');
      const incrementEl = getByTestId('increment');

      expect(countEl.textContent).toBe('0');

      await fireEvent.click(incrementEl);
      expect(countEl.textContent).toBe('1');
    });

    it('should use custom comparison function', async () => {
      const { useSelector } = await import('./index');

      const store = createStore({
        context: { items: [1, 2] },
        on: {
          same: (ctx) => ({ ...ctx, items: [1, 2] }),
          different: (ctx) => ({ ...ctx, items: [3, 4] })
        }
      });

      let updateCount = 0;
      const items = useSelector(
        store,
        (s) => s.context.items,
        (a, b) => JSON.stringify(a) === JSON.stringify(b)
      );

      // Vue refs need to be watched to track updates
      const { watch } = await import('vue');
      watch(
        items,
        () => {
          updateCount++;
        },
        { immediate: true }
      );

      expect(updateCount).toBe(1); // Initial

      store.send({ type: 'same' }); // Same content, should not trigger
      await new Promise((r) => setTimeout(r, 0));
      expect(updateCount).toBe(1);

      store.send({ type: 'different' }); // Different content
      await new Promise((r) => setTimeout(r, 0));
      expect(updateCount).toBe(2);
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
