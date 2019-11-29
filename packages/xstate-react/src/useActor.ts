import { useState, useRef, useEffect } from 'react';
import { EventObject } from 'xstate';
import { Actor } from 'xstate/lib/Actor';

export function useActor<TC, TE extends EventObject>(
  actor?: Actor<TC, TE>
): [TC | undefined, Actor<TC, TE>['send']] {
  const [current, setCurrent] = useState<TC | undefined>(undefined);
  const actorRef = useRef<Actor<TC, TE> | undefined>(actor);
  useEffect(() => {
    if (actor) {
      actorRef.current = actor;
      const sub = actor.subscribe((current) => setCurrent(current));
      return () => {
        sub.unsubscribe();
      };
    }
  }, [actor]);
  return [current, actorRef.current ? actorRef.current.send : () => void 0];
}
