import { useCallback } from 'react';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector';
import { AnyActorRef, AnyActorSystem, SnapshotFrom } from 'xstate';

type SyncExternalStoreSubscribe = Parameters<
  typeof useSyncExternalStoreWithSelector
>[0];

function defaultCompare<T>(a: T, b: T) {
  return a === b;
}

export function useSelector<
  TActor extends AnyActorRef | AnyActorSystem | undefined,
  T
>(
  actor: TActor,
  selector: (
    emitted: TActor extends AnyActorRef | AnyActorSystem
      ? SnapshotFrom<TActor>
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
    boundGetSnapshot,
    boundGetSnapshot,
    selector,
    compare
  );

  return selectedSnapshot;
}
