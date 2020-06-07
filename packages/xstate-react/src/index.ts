import { useState, useEffect } from 'react';
import { EventObject, ActorRef } from 'xstate';

export function useActor<TEvent extends EventObject, TEmitted>(
  actorRef: ActorRef<TEvent, TEmitted>
): [TEmitted, (event: TEvent) => void] {
  const [state, setState] = useState(actorRef.current);

  useEffect(() => {
    const sub = actorRef.subscribe((nextState) => {
      setState(nextState);
    });

    return () => sub.unsubscribe();
  }, [actorRef]);

  return [state, actorRef.send];
}

export { useMachine } from './useMachine';
export { useService } from './useService';
