import { useCallback } from 'react';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector';
import { ActorRef, Interpreter, Subscribable } from 'xstate';
import { isActorWithState } from './useActor';
import { getServiceSnapshot } from './useService';

function isService(actor: any): actor is Interpreter<any, any, any, any> {
  return 'state' in actor && 'machine' in actor;
}

const defaultCompare = (a, b) => a === b;
const defaultGetSnapshot = (a) =>
  isService(a)
    ? getServiceSnapshot(a)
    : isActorWithState(a)
    ? a.state
    : undefined;

export function useSelector<
  TActor extends ActorRef<any, any>,
  T,
  TEmitted = TActor extends Subscribable<infer Emitted> ? Emitted : never
>(
  actor: TActor,
  selector: (emitted: TEmitted) => T,
  compare: (a: T, b: T) => boolean = defaultCompare,
  getSnapshot: (a: TActor) => TEmitted = defaultGetSnapshot
) {
  const subscribe = useCallback(
    (handleStoreChange) => {
      const { unsubscribe } = actor.subscribe(handleStoreChange);
      return unsubscribe;
    },
    [actor]
  );

  const boundGetSnapshot = useCallback(() => getSnapshot(actor), [
    actor,
    getSnapshot
  ]);

  const selectedSnapshot = useSyncExternalStoreWithSelector(
    subscribe,
    boundGetSnapshot,
    boundGetSnapshot,
    selector,
    compare
  );

  return selectedSnapshot;
}
