/* @jsxImportSource solid-js */
import { AnyActorRef } from 'xstate';
import { createEffect, createSignal, onCleanup } from 'solid-js';
import { Store, SnapshotFromStore } from './types';

function defaultCompare<T>(a: T | undefined, b: T) {
  return a === b;
}

function useSelectorWithCompare<
  TStore extends
    | Store<any, any>
    | Pick<AnyActorRef, 'subscribe' | 'getSnapshot'>,
  T
>(
  selector: (
    snapshot: TStore extends Store<any, any>
      ? SnapshotFromStore<TStore>
      : TStore extends { getSnapshot(): infer TSnapshot }
        ? TSnapshot
        : never
  ) => T,
  compare: (a: T | undefined, b: T) => boolean = defaultCompare
): (
  snapshot: TStore extends Store<any, any>
    ? SnapshotFromStore<TStore>
    : TStore extends { getSnapshot(): infer TSnapshot }
      ? TSnapshot
      : never
) => T {
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
 * import { useSelector } from '@xstate/store/solid';
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
export function useSelector<
  TStore extends
    | Store<any, any>
    | Pick<AnyActorRef, 'subscribe' | 'getSnapshot'>,
  T
>(
  store: TStore,
  selector: (
    snapshot: TStore extends Store<any, any>
      ? SnapshotFromStore<TStore>
      : TStore extends { getSnapshot(): infer TSnapshot }
        ? TSnapshot
        : never
  ) => T,
  compare: (a: T | undefined, b: T) => boolean = defaultCompare
): () => T {
  const selectorWithCompare = useSelectorWithCompare(selector, compare);
  const [selectedValue, setSelectedValue] = createSignal(
    selectorWithCompare(store.getSnapshot() as any)
  );

  createEffect(() => {
    const subscription = store.subscribe(() => {
      const newValue = selectorWithCompare(store.getSnapshot() as any);
      setSelectedValue(() => newValue);
    });

    onCleanup(() => {
      subscription.unsubscribe();
    });
  });

  return selectedValue;
}
