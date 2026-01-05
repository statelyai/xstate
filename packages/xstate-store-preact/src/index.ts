export * from '@xstate/store';

import { useEffect, useState } from 'preact/hooks';
import { shallowEqual, type Readable } from '@xstate/store';

type EqualityFn<T> = (objA: T, objB: T) => boolean;

interface UseSelectorOptions<T> {
  compare?: EqualityFn<T>;
}

/**
 * A Preact hook that subscribes to a store and selects a value from the store's
 * snapshot via a selector function.
 *
 * @example
 *
 * ```tsx
 * import { store } from './store';
 * import { useSelector } from '@xstate/store-preact';
 *
 * function Counter() {
 *   const count = useSelector(store, (state) => state.context.count);
 *
 *   return <div>{count}</div>;
 * }
 * ```
 *
 * @param store The store, created from `createStore(…)`
 * @param selector A function which takes in the snapshot and returns a selected
 *   value
 * @param options Optional configuration with compare function
 * @returns The selected value
 */
export function useSelector<TStore extends Readable<any>, TSelected>(
  store: TStore,
  selector: (
    state: TStore extends Readable<infer T> ? T : never
  ) => TSelected = (d) => d as any,
  options: UseSelectorOptions<TSelected> = {}
): TSelected {
  const compare = options.compare ?? shallowEqual;

  const [selectedValue, setSelectedValue] = useState(() =>
    selector(store.get())
  );

  useEffect(() => {
    // Update immediately in case store changed between render and effect
    const currentSelected = selector(store.get());
    if (!compare(selectedValue, currentSelected)) {
      setSelectedValue(currentSelected);
    }

    const { unsubscribe } = store.subscribe((state) => {
      const nextSelected = selector(state);
      setSelectedValue((prev) => {
        if (compare(prev, nextSelected)) {
          return prev;
        }
        return nextSelected;
      });
    });

    return unsubscribe;
  }, [store, selector, compare]);

  return selectedValue;
}
