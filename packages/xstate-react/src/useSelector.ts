import { useCallback } from 'react';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector';
import { AnyActorRef } from 'xstate';

type SyncExternalStoreSubscribe = Parameters<
  typeof useSyncExternalStoreWithSelector
>[0];

function defaultCompare<T>(a: T, b: T) {
  return a === b;
}

export function useSelector<
  TActor extends Pick<AnyActorRef, 'subscribe' | 'getSnapshot'> | undefined,
  T
>(
  actor: TActor,
  selector: (
    snapshot: TActor extends { getSnapshot(): infer TSnapshot }
      ? TSnapshot
      : undefined
  ) => T,
  compare: (a: T, b: T) => boolean = defaultCompare
): T {
  const subscribe: SyncExternalStoreSubscribe = useCallback(
    (handleStoreChange) => {
      if (!actor) {
        return () => {};
      }
      const { unsubscribe } = actor.subscribe({
        next: handleStoreChange,
        error: handleStoreChange
      });
      return unsubscribe;
    },
    [actor]
  );

  const boundGetSnapshot = useCallback(() => {
    const snapshot = actor?.getSnapshot();
    if (snapshot && 'status' in snapshot && snapshot.status === 'error') {
      throw snapshot.error;
    }
    return snapshot;
  }, [actor]);

  const selectedSnapshot = useSyncExternalStoreWithSelector(
    subscribe,
    boundGetSnapshot,
    boundGetSnapshot,
    selector,
    compare
  );

  return selectedSnapshot;
}
