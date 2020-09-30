import { useMemo } from 'react';
import { EventObject, State, Interpreter, Typestate, Sender } from 'xstate';
import { useActor } from './useActor';
import { ActorRef } from './types';

export function fromService<TContext, TEvent extends EventObject>(
  service: Interpreter<TContext, any, TEvent>
): ActorRef<TEvent, State<TContext, TEvent>> {
  if (process.env.NODE_ENV !== 'production' && !('machine' in service)) {
    throw new Error(
      `Attempted to use an actor-like object instead of a service in the useService() hook. Please use the useActor() hook instead.`
    );
  }

  const { machine } = service as Interpreter<TContext, any, TEvent>;
  return {
    send: service.send.bind(service),
    subscribe: service.subscribe.bind(service),
    stop: service.stop!,
    current: service.status !== 0 ? service.state : machine.initialState,
    name: service.sessionId
  };
}

export function useService<
  TContext,
  TEvent extends EventObject,
  TTypestate extends Typestate<TContext> = { value: any; context: TContext }
>(
  service: Interpreter<TContext, any, TEvent, TTypestate>
): [State<TContext, TEvent, any, TTypestate>, Sender<TEvent>] {
  const serviceActor = useMemo(() => fromService(service), [service]);

  return useActor<TEvent, State<TContext, TEvent, any, TTypestate>>(
    serviceActor,
    (actor) => (actor as typeof serviceActor).current
  );
}
