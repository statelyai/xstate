import { ActorRef, Sender } from './ActorRef';
import { EventObject } from 'xstate';
import { useState, useEffect, useMemo } from 'react';

export function useActor<TCurrent, TEvent extends EventObject>(
  actorRef: ActorRef<TCurrent, TEvent>
): [TCurrent, Sender<TEvent>] {
  const [current, setCurrent] = useState(actorRef.current);

  const send = useMemo(() => actorRef.send, [actorRef]);

  useEffect(() => {
    const sub = actorRef.subscribe(latest => {
      setCurrent(latest);
    });

    return () => sub.unsubscribe();
  }, [actorRef]);

  return [current, send];
}
