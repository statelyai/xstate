/* @jsxImportSource solid-js */
import type { ActorRefFrom } from 'xstate';
import type { Accessor, Component } from 'solid-js';

import { useActor, useActorRef } from '@xstate/solid';
import { createRenderEffect, createSignal } from 'solid-js';
import { fireEvent, render, screen } from 'solid-testing-library';

import { createStore, fromStore } from '../src/index.ts';
import { useSelector } from '../src/solid.ts';

describe('Solid.js integration', () => {
  describe('useSelector', () => {
    // Ensure selectors react and result in renders as expected
    it('should minimize rerenders', () => {
      const store = createCounterStore();

      render(() => <Counter store={store} />);

      const counterLabel = screen.getByTestId('counter-label-value');
      const containerRenders = screen.getByTestId('counter-container-renders');
      const labelRenders = screen.getByTestId('counter-label-renders');
      const incrementButton = screen.getByTestId('increment-button');
      const otherButton = screen.getByTestId('other-button');

      expect(containerRenders.textContent).toBe('1');
      expect(labelRenders.textContent).toBe('1');
      expect(counterLabel.textContent).toBe('0');

      fireEvent.click(incrementButton);

      expect(counterLabel.textContent).toBe('1');
      expect(containerRenders.textContent).toBe('1');
      expect(labelRenders.textContent).toBe('2');

      fireEvent.click(otherButton);
      fireEvent.click(otherButton);
      fireEvent.click(otherButton);
      fireEvent.click(otherButton);

      expect(labelRenders.textContent).toBe('2');

      fireEvent.click(incrementButton);

      expect(counterLabel.textContent).toBe('2');
      expect(containerRenders.textContent).toBe('1');
      expect(labelRenders.textContent).toBe('3');
    });

    // Validate the expected behaviours of default and custom comparison functions
    it('can use a custom comparison function', async () => {
      const INITIAL_ITEMS = [1, 2];
      const DIFFERENT_ITEMS = [3, 4];
      const INITIAL_ITEMS_STRING = INITIAL_ITEMS.join(',');

      const store = createItemStore(INITIAL_ITEMS, DIFFERENT_ITEMS);

      const Container = () => {
        return (
          <>
            <ItemList store={store} name="default" comparison={undefined} />
            <ItemList
              store={store}
              name="custom"
              comparison={(a, b) => JSON.stringify(a) === JSON.stringify(b)}
            />

            <button
              data-testid="same"
              onClick={() => {
                store.send({ type: 'same' });
              }}
            >
              Change
            </button>
            <button
              data-testid="different"
              onClick={() => {
                store.send({ type: 'different' });
              }}
            >
              Change
            </button>
          </>
        );
      };

      render(() => <Container />);

      const defaultRendersDiv = await screen.findByTestId(
        'default-selector-renders'
      );
      const customRendersDiv = await screen.findByTestId(
        'custom-selector-renders'
      );

      const defaultItemsDiv = await screen.findByTestId(
        'default-selector-items'
      );
      const customItemsDiv = await screen.findByTestId('custom-selector-items');
      const differentButton = await screen.findByTestId('different');
      const sameButton = await screen.findByTestId('same');

      expect(defaultItemsDiv.textContent).toBe(INITIAL_ITEMS_STRING);
      expect(defaultRendersDiv.textContent).toBe('1');

      expect(customItemsDiv.textContent).toBe(INITIAL_ITEMS_STRING);
      expect(customRendersDiv.textContent).toBe('1');

      // Should cause a rerender for default selector, but not for custom selector
      fireEvent.click(sameButton);

      expect(defaultItemsDiv.textContent).toBe(INITIAL_ITEMS_STRING);
      expect(defaultRendersDiv.textContent).toBe('2');

      expect(customItemsDiv.textContent).toBe(INITIAL_ITEMS_STRING);
      expect(defaultRendersDiv.textContent).toBe('2');
      expect(customRendersDiv.textContent).toBe('1');

      // Toggling [1, 2] to [3, 4] should trigger a rerender for both selectors
      fireEvent.click(differentButton);

      expect(defaultItemsDiv.textContent).toBe('3,4');
      expect(customItemsDiv.textContent).toBe('3,4');
      expect(defaultRendersDiv.textContent).toBe('3');
      expect(customRendersDiv.textContent).toBe('2');

      // Both should rerender
      fireEvent.click(sameButton);

      expect(defaultItemsDiv.textContent).toBe(INITIAL_ITEMS_STRING);
      expect(customItemsDiv.textContent).toBe(INITIAL_ITEMS_STRING);
      expect(defaultRendersDiv.textContent).toBe('4');
      expect(customRendersDiv.textContent).toBe('3');

      // Only default selector should rerender
      fireEvent.click(sameButton);
      fireEvent.click(sameButton);

      expect(defaultItemsDiv.textContent).toBe(INITIAL_ITEMS_STRING);
      expect(customItemsDiv.textContent).toBe(INITIAL_ITEMS_STRING);
      expect(defaultRendersDiv.textContent).toBe('6');
      expect(customRendersDiv.textContent).toBe('3');
    });

    it('should allow batched updates', () => {
      const store = createCounterStore();

      const BatchCounter = () => {
        const count = useSelector(store, (s) => s.context.count);

        return (
          <div
            data-testid="count"
            onClick={() => {
              store.send({ type: 'increment' });
              store.send({ type: 'increment' });
            }}
          >
            {count()}
          </div>
        );
      };

      render(() => <BatchCounter />);

      const countDiv = screen.getByTestId('count');

      expect(countDiv.textContent).toEqual('0');

      fireEvent.click(countDiv);

      expect(countDiv.textContent).toEqual('2');
    });
  });

  describe('XState compatibility', () => {
    it('useActor (@xstate/solid) should work', () => {
      const store = fromStore(
        { count: 0 },
        {
          inc: { count: (ctx) => ctx.count + 1 }
        }
      );

      const Counter = () => {
        const [snapshot, send] = useActor(store);

        return (
          <div
            data-testid="count"
            onClick={() => {
              send({ type: 'inc' });
            }}
          >
            {snapshot.context.count}
          </div>
        );
      };

      render(() => <Counter />);

      const countDiv = screen.getByTestId('count');

      expect(countDiv.textContent).toEqual('0');

      fireEvent.click(countDiv);

      expect(countDiv.textContent).toEqual('1');
    });

    it('useActorRef (@xstate/solid) should work', () => {
      const store = fromStore(
        { count: 0 },
        { inc: { count: (ctx) => ctx.count + 1 } }
      );

      const Counter = () => {
        const actorRef = useActorRef(store);
        const count = useSelector(actorRef, (s) => s.context.count);

        return (
          <div
            data-testid="count"
            onClick={() => {
              actorRef.send({ type: 'inc' });
            }}
          >
            {count()}
          </div>
        );
      };

      render(() => <Counter />);

      const countDiv = screen.getByTestId('count');

      expect(countDiv.textContent).toEqual('0');

      fireEvent.click(countDiv);
      fireEvent.click(countDiv);
      fireEvent.click(countDiv);

      expect(countDiv.textContent).toEqual('3');
    });
  });
});

const useRenderTracker = (...accessors: Accessor<unknown>[]) => {
  const [renders, setRenders] = createSignal(0);
  createRenderEffect(() => {
    accessors.forEach((s) => s());
    setRenders((p) => p + 1);
  });
  return renders;
};

/**
 * A simple store that has `count` and `other` properties, and two actions which
 * increment `count`. It's paired with 2 small components to aid with testing
 * store behaviours.
 */
const createCounterStore = () =>
  createStore(
    { count: 0, other: 0 },
    {
      increment: { count: ({ count }) => count + 1 },
      other: { other: ({ other }) => other + 1 }
    }
  );

type CounterStore = ReturnType<typeof createCounterStore>;

const CounterLabel: Component<{ store: CounterStore }> = ({ store }) => {
  const count = useSelector(store, (s) => s.context.count);
  const renders = useRenderTracker(count);

  return (
    <>
      <div data-testid="counter-label-value">{count()}</div>;
      <div data-testid="counter-label-renders">{renders()}</div>;
    </>
  );
};

const Counter: Component<{ store: CounterStore }> = ({ store }) => {
  const renders = useRenderTracker();

  return (
    <div>
      <div data-testid="counter-container-renders">{renders()}</div>;
      <CounterLabel store={store} />
      <button
        data-testid="other-button"
        onclick={() => store.send({ type: 'other' })}
      />
      <button
        data-testid="increment-button"
        onclick={() => store.send({ type: 'increment' })}
      />
    </div>
  );
};

/**
 * A store that has an `items` property, and two actions which change `items`
 * between two different arrays. It's paired with 2 small components to aid with
 * testing store behaviours.
 *
 * The `comparison` parameter is used to determine whether the selectors should
 * be re-evaluated. If not provided, the selectors will be re-evaluated on every
 * change.
 */
const createItemStore = (initialItems: number[], differentItems: number[]) =>
  createStore(
    { items: initialItems },
    {
      same: { items: () => [...initialItems] },
      different: { items: () => differentItems }
    }
  );

const ItemList: Component<{
  store: ReturnType<typeof createItemStore>;
  name: string;
  comparison?: (a: number[] | undefined, b: number[]) => boolean;
}> = ({ store, name, comparison }) => {
  const items = useSelector(store, (s) => s.context.items, comparison);
  const renders = useRenderTracker(items);

  return (
    <div>
      <div data-testid={`${name}-selector-renders`}>{renders()}</div>
      <div data-testid={`${name}-selector-items`}>{items().join(',')}</div>
    </div>
  );
};
