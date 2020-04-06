import { useMemo, useCallback } from 'react';
import { EventObject, State, Interpreter, Typestate, Event } from 'xstate';
import { useActor } from './useActor';
import { fromService } from './ActorRef';

export function useService<
  TContext,
  TEvent extends EventObject,
  TTypestate extends Typestate<TContext> = any
>(
  service: Interpreter<TContext, any, TEvent, TTypestate>
): [State<TContext, TEvent, any, TTypestate>, (event: Event<TEvent>) => void] {
  const actorRef = useMemo(() => {
    return fromService<TContext, TEvent>(service);
  }, [service]);

  const [state, sendActor] = useActor(actorRef);

  const send = useCallback(
    (event: Event<TEvent>) => {
      const eventObject = typeof event === 'string' ? { type: event } : event;
      sendActor(eventObject as TEvent);
    },
    [sendActor]
  );

  return [state, send];
}
