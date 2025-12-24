import { fireEvent, render } from '@testing-library/vue';
import { defineComponent, ref, watch, type Ref } from 'vue';
import { createStore } from '../src/index.ts';
import { useSelector } from '../src/vue.ts';
import UseSelector from './UseSelector.vue';
import UseActor from './UseActor.vue';
import UseActorRef from './UseActorRef.vue';

/** A commonly reused store for testing selector behaviours. */
const createCounterStore = () =>
  createStore({
    context: { count: 0, other: 0 },
    on: {
      increment: (ctx) => ({
        ...ctx,
        count: ctx.count + 1
      }),
      other: (ctx) => ({
        ...ctx,
        other: ctx.other + 1
      })
    }
  });

describe('Vue.js integration', () => {
  describe('useSelector', () => {
    it('works with `useSelector(…)` (@xstate/vue)', async () => {
      const { getByTestId } = render(UseSelector);

      const countEl = getByTestId('count');
      const incrementEl = getByTestId('increment');

      await fireEvent.click(incrementEl);
      expect(countEl.textContent).toBe('1');
    });

    // Ensure selectors react and result in renders as expected
    it('should minimize rerenders', async () => {
      const store = createCounterStore();

      const CounterLabel = defineComponent({
        template: `
          <div>
            <div data-testid="counter-label-value">{{ count }}</div>
            <div data-testid="counter-label-renders">{{ renders }}</div>
          </div>
        `,
        setup() {
          const count = useSelector(store, (s) => s.context.count);
          const renders = ref(1); // Initial render

          // Track renders by watching when count changes
          watch(
            count,
            () => {
              renders.value++;
            },
            { immediate: false }
          );

          return { count, renders };
        }
      });

      const Counter = defineComponent({
        template: `
          <div>
            <div data-testid="counter-container-renders">{{ renders }}</div>
            <CounterLabel />
            <button data-testid="other-button" @click="handleOther">Other</button>
            <button data-testid="increment-button" @click="handleIncrement">Increment</button>
          </div>
        `,
        components: {
          CounterLabel
        },
        setup() {
          const renders = ref(1); // Initial render

          const handleOther = () => {
            store.send({ type: 'other' });
          };

          const handleIncrement = () => {
            store.send({ type: 'increment' });
          };

          return { renders, handleOther, handleIncrement };
        }
      });

      const { getByTestId } = render(Counter);

      const counterLabel = getByTestId('counter-label-value');
      const containerRenders = getByTestId('counter-container-renders');
      const labelRenders = getByTestId('counter-label-renders');
      const incrementButton = getByTestId('increment-button');
      const otherButton = getByTestId('other-button');

      // Initial render
      expect(containerRenders.textContent).toBe('1');
      expect(labelRenders.textContent).toBe('1');
      expect(counterLabel.textContent).toBe('0');

      await fireEvent.click(incrementButton);

      expect(counterLabel.textContent).toBe('1');
      expect(containerRenders.textContent).toBe('1');
      expect(labelRenders.textContent).toBe('2');

      await fireEvent.click(otherButton);
      await fireEvent.click(otherButton);
      await fireEvent.click(otherButton);
      await fireEvent.click(otherButton);

      // Label should not rerender since count didn't change
      expect(labelRenders.textContent).toBe('2');

      await fireEvent.click(incrementButton);

      expect(counterLabel.textContent).toBe('2');
      expect(containerRenders.textContent).toBe('1');
      expect(labelRenders.textContent).toBe('3');
    });

    // Validate the expected behaviours of default and custom comparison functions
    it('can use a custom comparison function', async () => {
      const INITIAL_ITEMS = [1, 2];
      const DIFFERENT_ITEMS = [3, 4];
      const INITIAL_ITEMS_STRING = INITIAL_ITEMS.join(',');
      const DIFFERENT_ITEMS_STRING = DIFFERENT_ITEMS.join(',');

      const store = createStore({
        context: { items: INITIAL_ITEMS },
        on: {
          same: (ctx) => ({
            ...ctx,
            items: [...INITIAL_ITEMS] // different array, same items
          }),
          different: (ctx) => ({
            ...ctx,
            items: DIFFERENT_ITEMS
          })
        }
      });

      const ItemList = defineComponent({
        props: {
          itemStore: {
            type: Object,
            required: true
          },
          name: {
            type: String,
            required: true
          },
          comparison: {
            type: Function,
            required: false
          }
        },
        template: `
          <div>
            <div :data-testid="name + '-selector-renders'">{{ renders }}</div>
            <div :data-testid="name + '-selector-items'">{{ items.join(',') }}</div>
          </div>
        `,
        setup(props: {
          itemStore: typeof store;
          name: string;
          comparison?: (a: number[] | undefined, b: number[]) => boolean;
        }) {
          const items = useSelector(
            props.itemStore,
            (s) => s.context.items,
            props.comparison
          );
          const renders = ref(1); // Initial render

          // Track renders by watching when items change
          watch(
            items,
            () => {
              renders.value++;
            },
            { immediate: false }
          );

          return { items, renders };
        }
      });

      const Container = defineComponent({
        template: `
          <div>
            <ItemList :item-store="store" name="default" />
            <ItemList :item-store="store" name="custom" :comparison="customComparison" />
            <button data-testid="same" @click="handleSame">Change</button>
            <button data-testid="different" @click="handleDifferent">Change</button>
          </div>
        `,
        components: {
          ItemList
        },
        setup() {
          const customComparison = (a: number[] | undefined, b: number[]) =>
            JSON.stringify(a) === JSON.stringify(b);

          const handleSame = () => {
            store.send({ type: 'same' });
          };

          const handleDifferent = () => {
            store.send({ type: 'different' });
          };

          return { store, customComparison, handleSame, handleDifferent };
        }
      });

      const { getByTestId } = render(Container);

      const defaultRendersDiv = getByTestId('default-selector-renders');
      const customRendersDiv = getByTestId('custom-selector-renders');

      const defaultItemsDiv = getByTestId('default-selector-items');
      const customItemsDiv = getByTestId('custom-selector-items');
      const differentButton = getByTestId('different');
      const sameButton = getByTestId('same');

      expect(defaultItemsDiv.textContent).toBe(INITIAL_ITEMS_STRING);
      expect(defaultRendersDiv.textContent).toBe('1');

      expect(customItemsDiv.textContent).toBe(INITIAL_ITEMS_STRING);
      expect(customRendersDiv.textContent).toBe('1');

      await fireEvent.click(sameButton);

      // Expect a rerender for default selector
      expect(defaultItemsDiv.textContent).toBe(INITIAL_ITEMS_STRING);
      expect(defaultRendersDiv.textContent).toBe('2');

      // Expect no rerender for custom selector
      expect(customItemsDiv.textContent).toBe(INITIAL_ITEMS_STRING);
      expect(defaultRendersDiv.textContent).toBe('2');
      expect(customRendersDiv.textContent).toBe('1');

      await fireEvent.click(differentButton);

      // Expect a rerender for both selectors
      expect(defaultItemsDiv.textContent).toBe(DIFFERENT_ITEMS_STRING);
      expect(customItemsDiv.textContent).toBe(DIFFERENT_ITEMS_STRING);
      expect(defaultRendersDiv.textContent).toBe('3');
      expect(customRendersDiv.textContent).toBe('2');

      await fireEvent.click(sameButton);

      // Expect a rerender for both selectors
      expect(defaultItemsDiv.textContent).toBe(INITIAL_ITEMS_STRING);
      expect(customItemsDiv.textContent).toBe(INITIAL_ITEMS_STRING);
      expect(defaultRendersDiv.textContent).toBe('4');
      expect(customRendersDiv.textContent).toBe('3');

      // Only default comparison selector should rerender
      await fireEvent.click(sameButton);
      await fireEvent.click(sameButton);

      // Expect only default selector to cause rerenders
      expect(defaultItemsDiv.textContent).toBe(INITIAL_ITEMS_STRING);
      expect(customItemsDiv.textContent).toBe(INITIAL_ITEMS_STRING);
      expect(defaultRendersDiv.textContent).toBe('6');
      expect(customRendersDiv.textContent).toBe('3');
    });

    it('should allow batched updates', async () => {
      const store = createCounterStore();

      const BatchCounter = defineComponent({
        template: `
          <div data-testid="count" @click="handleClick">{{ count }}</div>
        `,
        setup() {
          const count = useSelector(store, (s) => s.context.count);

          const handleClick = () => {
            store.send({ type: 'increment' });
            store.send({ type: 'increment' });
          };

          return { count, handleClick };
        }
      });

      const { getByTestId } = render(BatchCounter);

      const countDiv = getByTestId('count');

      expect(countDiv.textContent).toEqual('0');

      await fireEvent.click(countDiv);

      expect(countDiv.textContent).toEqual('2');
    });
  });

  describe('XState Vue hooks', () => {
    it('works with `useActor(…)` (@xstate/vue)', async () => {
      const { getByTestId } = render(UseActor);

      const countEl = getByTestId('count');
      const incrementEl = getByTestId('increment');

      await fireEvent.click(incrementEl);
      expect(countEl.textContent).toBe('1');
    });

    it('works with `useActorRef(…)` (@xstate/vue)', async () => {
      const { getByTestId } = render(UseActorRef);

      const countEl = getByTestId('count');
      const incrementEl = getByTestId('increment');

      await fireEvent.click(incrementEl);
      expect(countEl.textContent).toBe('1');
    });
  });
});
