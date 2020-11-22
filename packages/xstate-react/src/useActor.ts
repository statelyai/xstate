import { useState, useRef } from 'react';
import useIsomorphicLayoutEffect from 'use-isomorphic-layout-effect';
import { Sender } from './types';
import { ActorRef, EventObject } from 'xstate';
import useConstant from './useConstant';

function isActorWithState<T extends ActorRef<any>>(
  actorRef: T
): actorRef is T & { state: any } {
  return 'state' in actorRef;
}

function isDeferredActor<T extends ActorRef<any>>(
  actorRef: T
): actorRef is T & { deferred: boolean } {
  return 'deferred' in actorRef;
}

export function useActor<
  TEvent extends EventObject,
  TEmitted = unknown,
  TActor extends ActorRef<TEvent, TEmitted> = ActorRef<TEvent, TEmitted>
>(
  actorRef: TActor & ActorRef<TEvent, TEmitted>,
  getSnapshot: (actor: TActor) => TEmitted = (a) =>
    isActorWithState(a) ? a.state : (undefined as any)
): [TEmitted, Sender<TEvent>] {
  const actorRefRef = useRef(actorRef);
  const deferredEventsRef = useRef<TEvent[]>([]);
  const [current, setCurrent] = useState(() => getSnapshot(actorRef));

  const send: Sender<TEvent> = useConstant(() => (event) => {
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
    setCurrent(getSnapshot(actorRef));
    const subscription = actorRef.subscribe(setCurrent);

    // Dequeue deferred events from the previous deferred actorRef
    while (deferredEventsRef.current.length > 0) {
      const deferredEvent = deferredEventsRef.current.shift()!;

      actorRef.send(deferredEvent);
    }

    return () => {
      subscription.unsubscribe();
    };
  }, [actorRef]);

  return [current, send];
}
