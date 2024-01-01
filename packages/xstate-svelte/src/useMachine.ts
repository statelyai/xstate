import { AnyStateMachine, ActorOptions } from 'xstate';
import { useActor } from './useActor';

/** @alias useActor */
export function useMachine<TMachine extends AnyStateMachine>(
  machine: TMachine,
  options?: ActorOptions<TMachine>
) {
  return useActor(machine, options);
}
