import { useMemo } from 'react';
import { EventObject, State, Interpreter, Typestate, Sender } from 'xstate';
import { useActor } from './useActor';
import { ActorRef } from './types';

function fromService<TContext, TEvent extends EventObject>(
  service: Interpreter<TContext, any, TEvent, any>
): ActorRef<TEvent, State<TContext, TEvent>> {
  return {
    send: service.send.bind(service),
    subscribe: service.subscribe.bind(service),
    stop: service.stop.bind(service),
    current: service.state,
    name: service.sessionId
  };
}

export function useService<
  TContext,
  TEvent extends EventObject,
  TTypestate extends Typestate<TContext> = any
>(
  service: Interpreter<TContext, any, TEvent, TTypestate>
): [State<TContext, TEvent, any, TTypestate>, Sender<TEvent>] {
  const serviceActor = useMemo(() => fromService(service), [service]);
  const [state, send] = useActor<TEvent, State<TContext, TEvent>>(serviceActor);

  return [state, send];
}
