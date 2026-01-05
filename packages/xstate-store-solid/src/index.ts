/* @jsxImportSource solid-js */
export * from '@xstate/store';

import { createEffect, createSignal, onCleanup } from 'solid-js';
import type { SnapshotFromStore, AnyStore } from '@xstate/store';

function defaultCompare<T>(a: T | undefined, b: T) {
  return a === b;
}

function useSelectorWithCompare<TStore extends AnyStore, T>(
  selector: (snapshot: SnapshotFromStore<TStore>) => T,
  compare: (a: T | undefined, b: T) => boolean
): (snapshot: SnapshotFromStore<TStore>) => T {
  let previous: T | undefined;

  return (state): T => {
    const next = selector(state);

    if (previous === undefined || !compare(previous, next)) {
      previous = next;
    }

    return previous;
  };
}

/**
 * Creates a selector which subscribes to the store and selects a value from the
 * store's snapshot, using an optional comparison function.
 *
 * @example
 *
 * ```tsx
 * import { donutStore } from './donutStore.ts';
 * import { useSelector } from '@xstate/store-solid';
 *
 * function DonutCounter() {
 *   const donutCount = useSelector(donutStore, (state) => state.context.donuts);
 *
 *   return (
 *     <div>
 *       <button onClick={() => donutStore.send({ type: 'addDonut' })}>
 *         Add donut ({donutCount()})
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @param store The store, created from `createStore(…)`
 * @param selector A function which takes in the snapshot and returns a selected
 *   value from it
 * @param compare An optional function which compares the selected value to the
 *   previously selected value
 * @returns A read-only signal of the selected value
 */
export function useSelector<TStore extends AnyStore, T>(
  store: TStore,
  selector: (snapshot: SnapshotFromStore<TStore>) => T,
  compare: (a: T | undefined, b: T) => boolean = defaultCompare
): () => T {
  const selectorWithCompare = useSelectorWithCompare(selector, compare);
  const [selectedValue, setSelectedValue] = createSignal(
    selectorWithCompare(store.getSnapshot() as SnapshotFromStore<TStore>)
  );

  createEffect(() => {
    const subscription = store.subscribe(() => {
      const newValue = selectorWithCompare(
        store.getSnapshot() as SnapshotFromStore<TStore>
      );
      setSelectedValue(() => newValue);
    });

    onCleanup(() => {
      subscription.unsubscribe();
    });
  });

  return selectedValue;
}
