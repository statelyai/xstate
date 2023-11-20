import { useCallback } from 'react';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector';
import { ActorRef, SnapshotFrom, Subscribable } from 'xstate';

function defaultCompare<T>(a: T, b: T) {
  return a === b;
}

export function useSelector<
  TActor extends Pick<ActorRef<any>, 'getSnapshot' | 'subscribe'>,
  T
>(
  actor: TActor,
  selector: (emitted: SnapshotFrom<TActor>) => T,
  compare: (a: T, b: T) => boolean = defaultCompare
): T {
  const subscribe = useCallback(
    (handleStoreChange) => {
      const { unsubscribe } = actor.subscribe(handleStoreChange);
      return unsubscribe;
    },
    [actor]
  );

  const boundGetSnapshot = useCallback(() => {
    if (!actor) {
      return;
    }
    return actor.getSnapshot();
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
