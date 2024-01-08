import { useCallback } from 'react';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector';
import { ActorRef, SnapshotFrom } from 'xstate';

type SyncExternalStoreSubscribe = Parameters<
  typeof useSyncExternalStoreWithSelector
>[0];

function defaultCompare<T>(a: T, b: T) {
  return a === b;
}

export function useSelector<TActor extends ActorRef<any, any>, T>(
  actor: TActor,
  selector: (emitted: SnapshotFrom<TActor>) => T,
  compare?: (a: T, b: T) => boolean
): T;
export function useSelector<TActor extends ActorRef<any, any>, T>(
  actor: TActor | undefined,
  selector: (emitted: SnapshotFrom<TActor> | undefined) => T,
  compare?: (a: T, b: T) => boolean
): T;
export function useSelector<TActor extends ActorRef<any, any> | undefined, T>(
  actor: TActor | undefined,
  selector: (emitted: SnapshotFrom<TActor> | undefined) => T,
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
