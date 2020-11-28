import { useState, useRef } from 'react';
import useIsomorphicLayoutEffect from 'use-isomorphic-layout-effect';
import { Sender } from './types';
import { ActorRef } from 'xstate';
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

type EventOfActorRef<
  TActor extends ActorRef<any, any>
> = TActor extends ActorRef<infer TEvent, any> ? TEvent : never;
type EmittedOfActorRef<
  TActor extends ActorRef<any, any>
> = TActor extends ActorRef<any, infer TEmitted> ? TEmitted : never;

export function useActor<
  TActor extends ActorRef<any, any> = ActorRef<any, any>
>(
  actorRef: TActor,
  getSnapshot: (actor: TActor) => EmittedOfActorRef<TActor> = (a: TActor) =>
    isActorWithState(a) ? a.state : (undefined as any)
): [EmittedOfActorRef<TActor>, Sender<EventOfActorRef<TActor>>] {
  const actorRefRef = useRef(actorRef);
  const deferredEventsRef = useRef<Array<EventOfActorRef<TActor>>>([]);
  const [current, setCurrent] = useState(() => getSnapshot(actorRef));

  const send: Sender<EventOfActorRef<TActor>> = useConstant(() => (event) => {
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
    const subscription = actorRef.subscribe((emitted) => setCurrent(emitted));

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
