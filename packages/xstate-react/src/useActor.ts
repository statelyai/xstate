import { useState, useEffect } from 'react';
import { ActorRef, Sender } from './types';
import { EventObject } from 'xstate';

export function useActor<TEvent extends EventObject, TEmitted = any>(
  actorLike: ActorRef<TEvent, TEmitted>
): [TEmitted, Sender<TEvent>] {
  const [current, setCurrent] = useState(actorLike.current);

  useEffect(() => {
    const subscription = actorLike.subscribe(setCurrent);

    return () => {
      subscription.unsubscribe();
    };
  }, [actorLike]);

  return [current, actorLike.send];
}
