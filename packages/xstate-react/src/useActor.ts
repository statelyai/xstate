import { useCallback } from 'react';
import { ActorRef, EventObject } from 'xstate';
import { useSyncExternalStore } from 'use-sync-external-store/shim';

type EmittedFromActorRef<
  TActor extends ActorRef<any, any>
> = TActor extends ActorRef<any, infer TSnapshot> ? TSnapshot : never;

export function useActor<TActor extends ActorRef<any, any>, TSnapshot = any>(
  actorRef: TActor
): [EmittedFromActorRef<TActor>, TActor['send']];
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
