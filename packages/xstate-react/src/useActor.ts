import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ActorRef, Sender, ActorRefLike } from './types';
import { EventObject, Interpreter, Actor } from 'xstate';
import { fromService } from './useService';

function resolveActor(
  actorLike:
    | ActorRef<any, any>
    | ActorRefLike<any, any>
    | Interpreter<any, any>
    | Actor
): ActorRef<any, any> & { deferred?: boolean } {
  if (actorLike instanceof Interpreter) {
    return fromService(actorLike);
  }

  if (!('current' in actorLike)) {
    return {
      stop: () => {
        /* do nothing */
      },
      ...actorLike,
      subscribe: actorLike.subscribe as any, // TODO: fix (subscribe will work, just improperly typed)
      name: actorLike.id!,
      current: actorLike.state!
    };
  }

  return actorLike;
}

export function useActor<TEvent extends EventObject, TEmitted = any>(
  actorLike: ActorRefLike<TEvent, TEmitted> | Actor
): [TEmitted, Sender<TEvent>] {
  const actor = useMemo(() => resolveActor(actorLike), [actorLike]);
  const deferredEventsRef = useRef<EventObject[]>([]);
  const [current, setCurrent] = useState(actor.current);

  const send: Sender<TEvent> = useCallback(
    (event) => {
      // If the previous actor is a deferred actor,
      // queue the events so that they can be replayed
      // on the non-deferred actor.
      if (actor.deferred) {
        deferredEventsRef.current.push(event);
      } else {
        actor.send(event);
      }
    },
    [actor]
  );

  useEffect(() => {
    const subscription = actor.subscribe(setCurrent);

    // Dequeue deferred events from the previous deferred actor
    while (deferredEventsRef.current.length > 0) {
      const deferredEvent = deferredEventsRef.current.shift()!;

      actor.send(deferredEvent);
    }

    return () => {
      subscription.unsubscribe();
    };
  }, [actor]);

  return [current, send];
}
