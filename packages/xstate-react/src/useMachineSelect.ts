import {
  EventObject,
  StateMachine,
  Typestate,
  Interpreter,
  State
} from 'xstate';
import { MaybeLazy } from './types';
import { useMachine, UseMachineOptions } from './useMachine';

export function useMachineSelect<
  T,
  TContext,
  TEvent extends EventObject,
  TTypestate extends Typestate<TContext> = { value: any; context: TContext }
>(
  getMachine: MaybeLazy<StateMachine<TContext, any, TEvent, TTypestate>>,
  selector: (state: State<TContext, TEvent, any, TTypestate>) => T,
  options: Partial<UseMachineOptions<TContext, TEvent, TTypestate>> = {}
): [
  T,
  Interpreter<TContext, any, TEvent, TTypestate>['send'],
  Interpreter<TContext, any, TEvent, TTypestate>
] {
  const [state, send, service] = useMachine(getMachine, {
    ...options,
    filter: (currentState, prevState) => {
      return selector(currentState) !== selector(prevState);
    }
  });

  return [selector(state), send, service];
}
