import {
  AnyStateMachine,
  AreAllImplementationsAssumedToBeProvided,
  ActorOptions
} from 'xstate';
import { useActor } from './useActor';

type RestParams<TMachine extends AnyStateMachine> =
  AreAllImplementationsAssumedToBeProvided<
    TMachine['__TResolvedTypesMeta']
  > extends false
    ? [options: ActorOptions<TMachine>]
    : [options?: ActorOptions<TMachine>];

/** @deprecated */
export function useMachine<TMachine extends AnyStateMachine>(
  machine: TMachine,
  ...[options = {}]: RestParams<TMachine>
) {
  return useActor(machine, options);
}
