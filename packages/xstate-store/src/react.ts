import { Store } from '.';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector';
import { useCallback } from 'react';

type SyncExternalStoreSubscribe = Parameters<
  typeof useSyncExternalStoreWithSelector
>[0];

export function useStore<TStore extends Store<any, any>, TSelected>(
  store: TStore,
  selector?: (state: TStore) => TSelected
) {
  const subscribe: SyncExternalStoreSubscribe = useCallback(
    (handleStoreChange) => {
      const { unsubscribe } = store.subscribe(handleStoreChange);
      return unsubscribe;
    },
    [store]
  );

  const selected = useSyncExternalStoreWithSelector(
    subscribe,
    store.getSnapshot,
    store.getSnapshot,
    selector ?? ((s) => s)
    // TODO: equality fn
  );

  return selected;
}
