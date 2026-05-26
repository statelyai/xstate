import { fireEvent, render } from '@testing-library/vue';
import { defineComponent } from 'vue';
import TestCounter from './TestCounter.vue';
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
      const Counter = defineComponent({
        setup() {
          const store = useStore(counterLogic, { initialCount: 10 });
          const count = useSelector(store, (s) => s.context.count);
          return { count, store };
        },
        template: `
          <div>
            <button data-testid="increment" @click="store.trigger.inc()">Increment</button>
            <span data-testid="count">{{ count }}</span>
          </div>
        `
      });

      const { getByTestId } = render(Counter);

      expect(getByTestId('count').textContent).toBe('10');
      await fireEvent.click(getByTestId('increment'));
      expect(getByTestId('count').textContent).toBe('11');
    });
  });

  describe('useAtomState', () => {
    it('should return the value and existing atom', async () => {
      const atom = createAtom(0);
      const atomRefs: object[] = [];
      const Counter = defineComponent({
        setup() {
          const [count, countAtom] = useAtomState(atom);
          atomRefs.push(countAtom);
          return { count, countAtom };
        },
        template: `
          <div>
            <button data-testid="increment" @click="countAtom.set((count) => count + 1)">Increment</button>
            <span data-testid="count">{{ count }}</span>
          </div>
        `
      });

      const { getByTestId } = render(Counter);

      expect(getByTestId('count').textContent).toBe('0');
      await fireEvent.click(getByTestId('increment'));
      expect(getByTestId('count').textContent).toBe('1');
      expect(atomRefs.every((ref) => ref === atom)).toBe(true);
    });

    it('should create an atom from atom config and input', async () => {
      const config = createAtomConfig((input: { initialCount: number }) => {
        return input.initialCount;
      });
      const Counter = defineComponent({
        setup() {
          const [count, countAtom] = useAtomState(config, {
            initialCount: 10
          });
          return { count, countAtom };
        },
        template: `
          <div>
            <button data-testid="increment" @click="countAtom.set((count) => count + 1)">Increment</button>
            <span data-testid="count">{{ count }}</span>
          </div>
        `
      });

      const { getByTestId } = render(Counter);

      expect(getByTestId('count').textContent).toBe('10');
      await fireEvent.click(getByTestId('increment'));
      expect(getByTestId('count').textContent).toBe('11');
    });
  });

  describe('useAtom', () => {
    it('should create an atom value from atom config and input', () => {
      const config = createAtomConfig((input: { initialCount: number }) => {
        return input.initialCount;
      });
      const Counter = defineComponent({
        setup() {
          const count = useAtom(config, { initialCount: 10 });
          return { count };
        },
        template: `<span data-testid="count">{{ count }}</span>`
      });

      const { getByTestId } = render(Counter);
      expect(getByTestId('count').textContent).toBe('10');
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
