import { useCallback } from 'react';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector';
import { ActorRef, Subscribable } from 'xstate';

function defaultCompare<T>(a: T, b: T) {
  return a === b;
}

export function useSelector<
  TActor extends ActorRef<any, any>,
  T,
  TSnapshot = TActor extends Subscribable<infer Emitted> ? Emitted : never
>(
  actor: TActor,
  selector: (emitted: TSnapshot) => T,
  compare: (a: T, b: T) => boolean = defaultCompare
): T {
  const subscribe = useCallback(
    (handleStoreChange) => {
      const { unsubscribe } = actor.subscribe(handleStoreChange);
      return unsubscribe;
    },
    [actor]
  );

  const boundGetSnapshot = useCallback(() => actor.getSnapshot(), [actor]);

  const selectedSnapshot = useSyncExternalStoreWithSelector(
    subscribe,
    boundGetSnapshot,
    boundGetSnapshot,
    selector,
    compare
  );

  return selectedSnapshot;
}
