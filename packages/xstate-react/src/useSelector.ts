import { useCallback } from 'react';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector';
import { ActorRef, Snapshot, SnapshotFrom } from 'xstate';

function defaultCompare<T>(a: T, b: T) {
  return a === b;
}

export function useSelector<TActor extends ActorRef<any, any>, T>(
  actor: TActor,
  selector: (emitted: SnapshotFrom<TActor>) => T,
  compare: (a: T, b: T) => boolean = defaultCompare
): T {
  const subscribe = useCallback(
    (handleStoreChange) => {
      const { unsubscribe } = actor.subscribe(
        handleStoreChange,
        handleStoreChange
      );
      return unsubscribe;
    },
    [actor]
  );

  const boundGetSnapshot = useCallback(() => actor.getSnapshot(), [actor]);
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
