export * from '@xstate/store';

import { shallowEqual, type Readable as XStateReadable } from '@xstate/store';
import type { Readable } from 'svelte/store';

type EqualityFn<T> = (objA: T, objB: T) => boolean;

interface UseSelectorOptions<T> {
  compare?: EqualityFn<T>;
}

/**
 * Creates a Svelte readable store that subscribes to an XState store and
 * selects a value from the store's snapshot via a selector function.
 *
 * @example
 *
 * ```svelte
 * <script>
 * import { store } from './store';
 * import { useSelector } from '@xstate/store-svelte';
 *
 * const count = useSelector(store, (state) => state.context.count);
 * </script>
 *
 * <div>{$count}</div>
 * ```
 *
 * @param store The store, created from `createStore(…)`
 * @param selector A function which takes in the snapshot and returns a selected
 *   value
 * @param options Optional configuration with compare function
 * @returns A Svelte readable store
 */
export function useSelector<TStore extends XStateReadable<any>, TSelected>(
  store: TStore,
  selector: (
    state: TStore extends XStateReadable<infer T> ? T : never
  ) => TSelected = (d) => d as any,
  options: UseSelectorOptions<TSelected> = {}
): Readable<TSelected> {
  const compare = options.compare ?? shallowEqual;

  return {
    subscribe(run) {
      let currentValue = selector(store.get());
      run(currentValue);

      const { unsubscribe } = store.subscribe((state) => {
        const nextValue = selector(state);
        if (!compare(currentValue, nextValue)) {
          currentValue = nextValue;
          run(currentValue);
        }
      });

      return unsubscribe;
    }
  };
}
