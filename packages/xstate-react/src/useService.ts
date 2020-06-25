import { useMemo } from 'react';
import { EventObject, State, Interpreter, Typestate, Sender } from 'xstate';
import { useActor } from './useActor';
import { ActorRef } from './types';

export function fromService<TContext, TEvent extends EventObject>(
  service: Interpreter<TContext, any, TEvent, any>
): ActorRef<TEvent, State<TContext, TEvent>> {
  const { machine } = service;
  return {
    send: service.send.bind(service),
    subscribe: service.subscribe.bind(service),
    stop: service.stop,
    current: service.initialized ? service.state : machine.initialState,
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

  return useActor<TEvent, State<TContext, TEvent>>(serviceActor);
}
