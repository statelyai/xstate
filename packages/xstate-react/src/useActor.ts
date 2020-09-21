import { useState, useEffect, useRef, useCallback } from 'react';
import { Sender, ActorRefLike } from './types';
import { EventObject, Actor } from 'xstate';

export function useActor<TEvent extends EventObject, TEmitted = any>(
  actorRef: ActorRefLike<TEvent, TEmitted> | Actor,
  getSnapshot: (actor: typeof actorRef) => TEmitted = (a) =>
    'state' in a ? a.state : (undefined as any)
): [TEmitted, Sender<TEvent>] {
  // const actor = useMemo(() => resolveActor(actorLike), [actorLike]);
  const deferredEventsRef = useRef<TEvent[]>([]);
  const [current, setCurrent] = useState(() => getSnapshot(actorRef));

  const send: Sender<TEvent> = useCallback(
    (event) => {
      // If the previous actor is a deferred actor,
      // queue the events so that they can be replayed
      // on the non-deferred actor.
      if ('deferred' in actorRef && actorRef.deferred) {
        deferredEventsRef.current.push(event);
      } else {
        actorRef.send(event);
      }
    },
    [actorRef]
  );

  useEffect(() => {
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
