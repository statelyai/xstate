import {
  ActorRefFrom,
  AnyStateMachine,
  AreAllImplementationsAssumedToBeProvided,
  ActorOptions,
  MissingImplementationsError,
  StateFrom
} from 'xstate';
import { useActor } from './useActor.ts';

/**
 * @alias useActor
 */
export function useMachine<TMachine extends AnyStateMachine>(
  machine: AreAllImplementationsAssumedToBeProvided<
    TMachine['__TResolvedTypesMeta']
  > extends true
    ? TMachine
    : MissingImplementationsError<TMachine['__TResolvedTypesMeta']>,
  options: ActorOptions<TMachine> = {}
): [
  StateFrom<TMachine>,
  ActorRefFrom<TMachine>['send'],
  ActorRefFrom<TMachine>
] {
  return useActor(machine as any, options as any) as any;
}
