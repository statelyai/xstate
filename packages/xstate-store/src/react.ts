import { useCallback } from 'react';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector';
import { Store, SnapshotFromStore } from './types';

type SyncExternalStoreSubscribe = Parameters<
  typeof useSyncExternalStoreWithSelector
>[0];

function defaultCompare<T>(a: T, b: T) {
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
export function useSelector<TStore extends Store<any, any> | undefined, T>(
  store: TStore,
  selector: (
    snapshot: TStore extends Store<any, any>
      ? SnapshotFromStore<TStore>
      : undefined
  ) => T,
  compare: (a: T, b: T) => boolean = defaultCompare
): T {
  const subscribe: SyncExternalStoreSubscribe = useCallback(
    (handleStoreChange) => {
      if (!store) {
        return () => {};
      }
      const { unsubscribe } = store.subscribe(handleStoreChange);
      return unsubscribe;
    },
    [store]
  );

  const boundGetSnapshot = useCallback(() => store?.getSnapshot(), [store]);

  const selectedSnapshot = useSyncExternalStoreWithSelector(
    subscribe,
    // @ts-ignore
    boundGetSnapshot,
    boundGetSnapshot,
    selector,
    compare
  );

  return selectedSnapshot;
}
