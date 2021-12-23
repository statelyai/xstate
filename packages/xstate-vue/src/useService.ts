import {
  EventObject,
  State,
  Interpreter,
  PayloadSender,
  MachineContext
} from 'xstate';

import { Ref, isRef } from 'vue';

import { useActor } from './useActor';

/**
 * @deprecated Use `useActor` instead.
 *
 * @param service The interpreted machine
 * @returns A tuple of the current `state` of the service and the service's `send(event)` method
 */
export function useService<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  service: Interpreter<TContext, TEvent> | Ref<Interpreter<TContext, TEvent>>
): {
  state: Ref<State<TContext, TEvent>>;
  send: PayloadSender<TEvent>;
} {
  if (
    process.env.NODE_ENV !== 'production' &&
    !('machine' in (isRef(service) ? service.value : service))
  ) {
    throw new Error(
      `Attempted to use an actor-like object instead of a service in the useService() hook. Please use the useActor() hook instead.`
    );
  }

  const { state, send } = useActor(service);

  return { state, send };
}
