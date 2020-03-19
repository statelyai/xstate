import { ActorRef } from './ActorRef';
import { EventObject } from '@xstate/fsm/src';
import { useState, useEffect, useMemo } from 'react';

export function useActor<TCurrent, TEvent extends EventObject>(
  actorRef: ActorRef<TCurrent, TEvent>
) {
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
