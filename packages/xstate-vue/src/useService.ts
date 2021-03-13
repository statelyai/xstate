// import { shallowRef, watch, isRef, Ref } from 'vue';
import {
  EventObject,
  State,
  Interpreter,
  Typestate,
  PayloadSender
} from 'xstate';

import { Ref, isRef, shallowRef } from 'vue';

import { useActor } from './useActor';

export function getServiceSnapshot<
  TService extends Interpreter<any, any, any, any>
>(service: TService): TService['state'] {
  // TODO: remove compat lines in a new major, replace literal number with InterpreterStatus then as well
  return ('status' in service ? service.status : (service as any)._status) !== 0
    ? service.state
    : service.machine.initialState;
}

export function useService<
  TContext,
  TEvent extends EventObject,
  TTypestate extends Typestate<TContext> = { value: any; context: TContext }
>(
  service:
    | Interpreter<TContext, any, TEvent, TTypestate>
    | Ref<Interpreter<TContext, any, TEvent, TTypestate>>
): {
  state: State<TContext, TEvent, any, TTypestate>;
  send: PayloadSender<TEvent>;
} {
  // if (process.env.NODE_ENV !== 'production' && !('machine' in service)) {
  //   throw new Error(
  //     `Attempted to use an actor-like object instead of a service in the useService() hook. Please use the useActor() hook instead.`
  //   );
  // }

  const serviceRef = isRef(service) ? service : shallowRef(service);

  const { state, send } = useActor(serviceRef, getServiceSnapshot);

  return { state, send };
}
