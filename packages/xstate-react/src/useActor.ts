import { useState, useEffect, useRef } from 'react';
import { Sender, ActorRefLike } from './types';
import { EventObject, Actor } from 'xstate';
import useConstant from './useConstant';

export function useActor<TEvent extends EventObject, TEmitted = any>(
  actorRef: ActorRefLike<TEvent, TEmitted> | Actor,
  getSnapshot: (actor: typeof actorRef) => TEmitted = (a) =>
    'state' in a ? a.state : (undefined as any)
): [TEmitted, Sender<TEvent>] {
  const actorRefRef = useRef(actorRef);
  const deferredEventsRef = useRef<TEvent[]>([]);
  const [current, setCurrent] = useState(() => getSnapshot(actorRef));

  const send: Sender<TEvent> = useConstant(() => (event) => {
    const currentActorRef = actorRefRef.current;
    // If the previous actor is a deferred actor,
    // queue the events so that they can be replayed
    // on the non-deferred actor.
    if ('deferred' in currentActorRef && currentActorRef.deferred) {
      deferredEventsRef.current.push(event);
    } else {
      currentActorRef.send(event);
    }
  });

  useEffect(() => {
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
