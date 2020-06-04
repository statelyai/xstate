import { useState, useEffect } from 'react';
import { ActorRefLike, ActorRef, Sender } from './types';
import { EventObject } from 'xstate';

const defaultGetCurrentValue = <TEvent extends EventObject, TEmitted = any>(
  actorLike: ActorRef<TEvent, TEmitted> | ActorRefLike<TEvent, TEmitted>
): TEmitted => {
  return 'current' in actorLike ? actorLike.current : (undefined as any); // V4 Actors do not have 'current'
};

export function useActor<TEvent extends EventObject, TEmitted = any>(
  actorLike: ActorRef<TEvent, TEmitted> | ActorRefLike<TEvent, TEmitted>,
  getCurrentValue: <TEvent extends EventObject, TEmitted = any>(
    actorLike: ActorRef<TEvent, TEmitted> | ActorRefLike<TEvent, TEmitted>
  ) => TEmitted = defaultGetCurrentValue
): [TEmitted, Sender<TEvent>] {
  const [current, setCurrent] = useState(getCurrentValue(actorLike));

  useEffect(() => {
    const subscription = actorLike.subscribe((latest) => {
      setCurrent(latest);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [actorLike]);

  return [current, actorLike.send];
}
