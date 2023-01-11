import { useCallback, useRef } from 'react';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector';
import { ActorRef, AnyState, Subscribable } from 'xstate';
import { isActorWithState } from './useActor';
import { getServiceSnapshot, isService } from './utils';

const defaultCompare = (a, b) => a === b;
const defaultGetSnapshot = (a, initialStateCacheRef) => {
  if (isService(a)) {
    // A status of 0 = interpreter not started
    if (a.status === 0 && initialStateCacheRef.current) {
      return initialStateCacheRef.current;
    }
    const snapshot = getServiceSnapshot(a);
    initialStateCacheRef.current = a.status === 0 ? snapshot : null;
    return snapshot;
  }
  return isActorWithState(a) ? a.state : undefined;
};

export function useSelector<
  TActor extends ActorRef<any, any>,
  T,
  TEmitted = TActor extends Subscribable<infer Emitted> ? Emitted : never
>(
  actor: TActor,
  selector: (emitted: TEmitted) => T,
  compare: (a: T, b: T) => boolean = defaultCompare,
  getSnapshot?: (a: TActor) => TEmitted
): T {
  const initialStateCacheRef = useRef<AnyState | null>(null);

  const subscribe = useCallback(
    (handleStoreChange) => {
      const { unsubscribe } = actor.subscribe(handleStoreChange);
      return unsubscribe;
    },
    [actor]
  );

  const boundGetSnapshot = useCallback(() => {
    if (getSnapshot) {
      return getSnapshot(actor);
    }
    return defaultGetSnapshot(actor, initialStateCacheRef);
  }, [actor, getSnapshot]);

  const selectedSnapshot = useSyncExternalStoreWithSelector(
    subscribe,
    boundGetSnapshot,
    boundGetSnapshot,
    selector,
    compare
  );

  return selectedSnapshot;
}
