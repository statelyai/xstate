import {
  AnyStateMachine,
  AreAllImplementationsAssumedToBeProvided,
  InterpreterFrom,
  InterpreterOptions,
  MissingImplementationsError,
  StateFrom
} from 'xstate';
import { Prop } from './types.ts';
import { useActor } from './useActor.ts';

type UseMachineReturn<
  TMachine extends AnyStateMachine,
  TInterpreter = InterpreterFrom<TMachine>
> = [StateFrom<TMachine>, Prop<TInterpreter, 'send'>, TInterpreter];

/**
 *
 * @deprecated Use `useActor(...)` instead.
 */
export function useMachine<TMachine extends AnyStateMachine>(
  machine: AreAllImplementationsAssumedToBeProvided<
    TMachine['__TResolvedTypesMeta']
  > extends true
    ? TMachine
    : MissingImplementationsError<TMachine['__TResolvedTypesMeta']>,
  options: InterpreterOptions<TMachine> = {}
): UseMachineReturn<TMachine> {
  return useActor(machine, options as any);
}
