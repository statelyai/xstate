import { useCallback } from 'react';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector';
import { AnyActorRef, Snapshot, SnapshotFrom } from 'xstate';

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
      const { unsubscribe } = actor.subscribe(
        handleStoreChange,
        handleStoreChange
      );
      return unsubscribe;
    },
    [actor]
  );

  const boundGetSnapshot = useCallback(() => actor?.getSnapshot(), [actor]);
  const boundSelector: typeof selector = useCallback(
    (snapshot: Snapshot<any>) => {
      if (snapshot.status === 'error') {
        throw snapshot.error;
      }
      return selector(snapshot as never);
    },
    [selector]
  );

  const selectedSnapshot = useSyncExternalStoreWithSelector(
    subscribe,
    boundGetSnapshot,
    boundGetSnapshot,
    boundSelector,
    compare
  );

  return selectedSnapshot;
}
