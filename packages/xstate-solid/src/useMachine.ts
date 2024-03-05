import type { ActorOptions, AnyStateMachine } from 'xstate';
import { useActor } from './useActor.ts';

/** @alias useActor */
export function useMachine<TMachine extends AnyStateMachine>(
  machine: TMachine,
  options?: ActorOptions<TMachine>
) {
  return useActor(machine, options);
}
