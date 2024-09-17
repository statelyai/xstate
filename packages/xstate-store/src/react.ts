import { useCallback } from 'react';
import { SnapshotFromStore, AnyStore } from './types';
import { useSyncExternalStoreWithSelector } from './useSyncExternalStoreWithSelector';

function defaultCompare<T>(a: T | undefined, b: T) {
  return a === b;
}
/**
 * A React hook that subscribes to the `store` and selects a value from the
 * store's snapshot, with an optional compare function.
 *
 * @example
 *
 * ```ts
 * function Component() {
 *   const count = useSelector(store, (s) => s.count);
 *
 *   return <div>{count}</div>;
 * }
 * ```
 *
 * @param store The store, created from `createStore(…)`
 * @param selector A function which takes in the `snapshot` and returns a
 *   selected value
 * @param compare An optional function which compares the selected value to the
 *   previous value
 * @returns The selected value
 */
export function useSelector<TStore extends AnyStore, T>(
  store: TStore,
  selector: (snapshot: SnapshotFromStore<TStore>) => T,
  compare: (a: T | undefined, b: T) => boolean = defaultCompare
): T {
  const boundGetSnapshot = useCallback(
    () => store?.getSnapshot() as SnapshotFromStore<TStore>,
    [store]
  );

  return useSyncExternalStoreWithSelector(
    useCallback(
      (handleStoreChange) => store.subscribe(handleStoreChange).unsubscribe,
      [store]
    ),
    boundGetSnapshot,
    boundGetSnapshot,
    selector,
    compare
  );
}
