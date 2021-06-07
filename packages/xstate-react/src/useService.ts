import { EventObject, State, Interpreter, Typestate } from 'xstate';
import { useActor } from './useActor';
import { PayloadSender } from './types';

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
  service: Interpreter<TContext, any, TEvent, TTypestate>
): [State<TContext, TEvent, any, TTypestate>, PayloadSender<TEvent>] {
  const [state] = useActor(service);

  return [state, service.send];
}
