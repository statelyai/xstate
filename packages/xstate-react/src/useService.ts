import { EventObject, State, Interpreter, Typestate } from 'xstate';
import { useActor } from './useActor';
import { PayloadSender } from './types';

export function useService<
  TContext,
  TEvent extends EventObject,
  TTypestate extends Typestate<TContext> = { value: any; context: TContext }
>(
  service: Interpreter<TContext, TEvent, any, TTypestate>
): [State<TContext, TEvent, any, TTypestate>, PayloadSender<TEvent>] {
  if (process.env.NODE_ENV !== 'production' && !('machine' in service)) {
    throw new Error(
      `Attempted to use an actor-like object instead of a service in the useService() hook. Please use the useActor() hook instead.`
    );
  }

  const [state] = useActor(service, () =>
    // TODO: remove compat lines in a new major, replace literal number with InterpreterStatus then as well
    ('status' in service ? service.status : (service as any)._status) !== 0
      ? service.state
      : service.machine.initialState
  );

  return [state, service.send];
}
