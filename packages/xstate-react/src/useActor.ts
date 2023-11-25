import { useRef, useCallback } from 'react';
import useIsomorphicLayoutEffect from 'use-isomorphic-layout-effect';
import { ActorRef, EventObject, Sender } from 'xstate';
import useConstant from './useConstant';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector';
import {
  getServiceSnapshot,
  isInterpreterStateEqual,
  isService
} from './utils';

function identity<T>(a: T) {
  return a;
}

export function isActorWithState<T extends ActorRef<any>>(
  actorRef: T
): actorRef is T & { state: any } {
  return 'state' in actorRef;
}

function isDeferredActor<T extends ActorRef<any>>(
  actorRef: T
): actorRef is T & { deferred: boolean } {
  return 'deferred' in actorRef;
}

type EmittedFromActorRef<TActor extends ActorRef<any, any>> =
  TActor extends ActorRef<any, infer TEmitted> ? TEmitted : never;

function defaultGetSnapshot<TEmitted>(
  actorRef: ActorRef<any, TEmitted>
): TEmitted | undefined {
  return 'getSnapshot' in actorRef
    ? isService(actorRef)
      ? getServiceSnapshot(actorRef as any)
      : actorRef.getSnapshot()
    : isActorWithState(actorRef)
    ? actorRef.state
    : undefined;
}

export function useActor<TActor extends ActorRef<any, any>>(
  actorRef: TActor,
  getSnapshot?: (actor: TActor) => EmittedFromActorRef<TActor>
): [EmittedFromActorRef<TActor>, TActor['send']];
export function useActor<TEvent extends EventObject, TEmitted>(
  actorRef: ActorRef<TEvent, TEmitted>,
  getSnapshot?: (actor: ActorRef<TEvent, TEmitted>) => TEmitted
): [TEmitted, Sender<TEvent>];
export function useActor(
  actorRef: ActorRef<EventObject, unknown>,
  getSnapshot: (
    actor: ActorRef<EventObject, unknown>
  ) => unknown = defaultGetSnapshot
): [unknown, Sender<EventObject>] {
  const actorRefRef = useRef(actorRef);
  const deferredEventsRef = useRef<(EventObject | string)[]>([]);

  const subscribe = useCallback(
    (handleStoreChange) => {
      const { unsubscribe } = actorRef.subscribe(handleStoreChange);
      return unsubscribe;
    },
    [actorRef]
  );

  const boundGetSnapshot = useCallback(
    () => getSnapshot(actorRef),
    [actorRef, getSnapshot]
  );

  const isEqual = useCallback(
    (prevState, nextState) => {
      if (isService(actorRef)) {
        return isInterpreterStateEqual(actorRef, prevState, nextState);
      }
      return prevState === nextState;
    },
    [actorRef]
  );

  const storeSnapshot = useSyncExternalStoreWithSelector(
    subscribe,
    boundGetSnapshot,
    boundGetSnapshot,
    identity,
    isEqual
  );

  const send: Sender<EventObject> = useConstant(() => (...args) => {
    const event = args[0];

    if (process.env.NODE_ENV !== 'production' && args.length > 1) {
      console.warn(
        `Unexpected payload: ${JSON.stringify(
          (args as any)[1]
        )}. Only a single event object can be sent to actor send() functions.`
      );
    }

    const currentActorRef = actorRefRef.current;
    // If the previous actor is a deferred actor,
    // queue the events so that they can be replayed
    // on the non-deferred actor.
    if (isDeferredActor(currentActorRef) && currentActorRef.deferred) {
      deferredEventsRef.current.push(event);
    } else {
      currentActorRef.send(event);
    }
  });

  useIsomorphicLayoutEffect(() => {
    actorRefRef.current = actorRef;

    // Dequeue deferred events from the previous deferred actorRef
    while (deferredEventsRef.current.length > 0) {
      const deferredEvent = deferredEventsRef.current.shift()!;

      actorRef.send(deferredEvent);
    }
  }, [actorRef]);

  return [storeSnapshot, send];
}
