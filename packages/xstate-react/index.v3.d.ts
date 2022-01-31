import {
  EventObject,
  Interpreter,
  InterpreterOptions,
  MachineOptions,
  Observer,
  State,
  StateMachine,
  Typestate
} from 'xstate';
import { MaybeLazy, UseMachineOptions } from './lib/types';

export * from './lib/index';

export declare function useMachine<
  TContext,
  TEvent extends EventObject,
  TTypestate extends Typestate<TContext> = {
    value: any;
    context: TContext;
  }
>(
  getMachine: MaybeLazy<StateMachine<TContext, any, TEvent, TTypestate>>,
  options?: InterpreterOptions &
    UseMachineOptions<TContext, TEvent> &
    MachineOptions<TContext, TEvent>
): [
  State<TContext, TEvent, any, TTypestate>,
  Interpreter<TContext, any, TEvent, TTypestate>['send'],
  Interpreter<TContext, any, TEvent, TTypestate>
];

export declare function useInterpret<
  TContext,
  TEvent extends EventObject,
  TTypestate extends Typestate<TContext> = { value: any; context: TContext }
>(
  getMachine: MaybeLazy<StateMachine<TContext, any, TEvent, TTypestate>>,
  options?: InterpreterOptions &
    UseMachineOptions<TContext, TEvent> &
    MachineOptions<TContext, TEvent>,
  observerOrListener?:
    | Observer<State<TContext, TEvent, any, TTypestate>>
    | ((value: State<TContext, TEvent, any, TTypestate>) => void)
): Interpreter<TContext, any, TEvent, TTypestate>;
