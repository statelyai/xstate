import { useCallback } from 'react';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector';
import { Store, SnapshotFromStore } from './types';

type SyncExternalStoreSubscribe = Parameters<
  typeof useSyncExternalStoreWithSelector
>[0];

function defaultCompare<T>(a: T, b: T) {
  return a === b;
}

export function useSelector<TStore extends Store<any, any> | undefined, T>(
  actor: TStore,
  selector: (
    emitted: TStore extends Store<any, any>
      ? SnapshotFromStore<TStore>
      : undefined
  ) => T,
  compare: (a: T, b: T) => boolean = defaultCompare
): T {
  const subscribe: SyncExternalStoreSubscribe = useCallback(
    (handleStoreChange) => {
      if (!actor) {
        return () => {};
      }
      const { unsubscribe } = actor.subscribe(handleStoreChange);
      return unsubscribe;
    },
    [actor]
  );

  const boundGetSnapshot = useCallback(() => actor?.getSnapshot(), [actor]);

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
