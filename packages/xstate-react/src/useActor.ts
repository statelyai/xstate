import { useCallback } from 'react';
import { ActorRef, EventObject, SnapshotFrom } from 'xstate';
import { useSyncExternalStore } from 'use-sync-external-store/shim';

export function useActor<TActor extends ActorRef<any, any>>(
  actorRef: TActor
): [SnapshotFrom<TActor>, TActor['send']];
export function useActor<TEvent extends EventObject, TSnapshot>(
  actorRef: ActorRef<TEvent, TSnapshot>
): [TSnapshot, (event: TEvent) => void];
export function useActor(
  actorRef: ActorRef<EventObject, unknown>
): [unknown, (event: EventObject) => void] {
  const subscribe = useCallback(
    (handleStoreChange) => {
      const { unsubscribe } = actorRef.subscribe(handleStoreChange);
      return unsubscribe;
    },
    [actorRef]
  );

  const boundGetSnapshot = useCallback(() => actorRef.getSnapshot(), [
    actorRef
  ]);

  const storeSnapshot = useSyncExternalStore(
    subscribe,
    boundGetSnapshot,
    boundGetSnapshot
  );

  const boundSend: typeof actorRef.send = useCallback(
    (event) => actorRef.send(event),
    [actorRef]
  );

  return [storeSnapshot, boundSend];
}
