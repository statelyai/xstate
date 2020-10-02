import { useMemo } from 'react';
import { EventObject, State, Interpreter, Typestate } from 'xstate';
import { useActor } from './useActor';
import { ActorRef } from './types';

export function fromService<TContext, TEvent extends EventObject>(
  service: Interpreter<TContext, TEvent, any>
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
  TTypestate extends Typestate<TContext> = { value: any; context: TContext }
>(
  service: Interpreter<TContext, TEvent, any, TTypestate>
): [
  State<TContext, TEvent, any, TTypestate>,
  (event: TEvent | TEvent['type']) => void
] {
  const serviceActor = useMemo(() => fromService(service), [service]);

  return useActor<TEvent, State<TContext, TEvent, any, TTypestate>>(
    serviceActor,
    (actor) => (actor as typeof serviceActor).current
  );
}
