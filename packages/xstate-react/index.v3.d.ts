import {
  AnyStateMachine,
  AreAllImplementationsAssumedToBeProvided,
  InternalMachineOptions,
  InterpreterFrom,
  InterpreterOptions,
  Observer,
  StateFrom
} from 'xstate';
import { MaybeLazy, Prop, UseMachineOptions } from './lib/types';

export * from './lib/index';

type UseMachineReturn<
  TMachine extends AnyStateMachine,
  TInterpreter = InterpreterFrom<TMachine>
> = [StateFrom<TMachine>, Prop<TInterpreter, 'send'>, TInterpreter];

type UseMachineRestParams<TMachine extends AnyStateMachine> =
  AreAllImplementationsAssumedToBeProvided<
    TMachine['__TResolvedTypesMeta']
  > extends false
    ? [
        InterpreterOptions &
          UseMachineOptions<TMachine['__TContext'], TMachine['__TEvent']> &
          InternalMachineOptions<
            TMachine['__TContext'],
            TMachine['__TEvent'],
            TMachine['__TResolvedTypesMeta'],
            true
          >
      ]
    : [
        (InterpreterOptions &
          UseMachineOptions<TMachine['__TContext'], TMachine['__TEvent']> &
          InternalMachineOptions<
            TMachine['__TContext'],
            TMachine['__TEvent'],
            TMachine['__TResolvedTypesMeta']
          >)?
      ];

export declare function useMachine<TMachine extends AnyStateMachine>(
  getMachine: MaybeLazy<TMachine>
): UseMachineReturn<TMachine>;

export declare function useMachine<TMachine extends AnyStateMachine>(
  getMachine: MaybeLazy<TMachine>,
  ...options: UseMachineRestParams<TMachine>
): UseMachineReturn<TMachine>;

type UseInterpretRestParams<TMachine extends AnyStateMachine> =
  AreAllImplementationsAssumedToBeProvided<
    TMachine['__TResolvedTypesMeta']
  > extends false
    ? [
        InterpreterOptions &
          UseMachineOptions<TMachine['__TContext'], TMachine['__TEvent']> &
          InternalMachineOptions<
            TMachine['__TContext'],
            TMachine['__TEvent'],
            TMachine['__TResolvedTypesMeta'],
            true
          >,
        (
          | Observer<StateFrom<TMachine>>
          | ((value: StateFrom<TMachine>) => void)
        )?
      ]
    : [
        (InterpreterOptions &
          UseMachineOptions<TMachine['__TContext'], TMachine['__TEvent']> &
          InternalMachineOptions<
            TMachine['__TContext'],
            TMachine['__TEvent'],
            TMachine['__TResolvedTypesMeta']
          >)?,
        (
          | Observer<StateFrom<TMachine>>
          | ((value: StateFrom<TMachine>) => void)
        )?
      ];

export declare function useInterpret<TMachine extends AnyStateMachine>(
  getMachine: MaybeLazy<TMachine>,
  ...options: UseInterpretRestParams<TMachine>
): InterpreterFrom<TMachine>;
