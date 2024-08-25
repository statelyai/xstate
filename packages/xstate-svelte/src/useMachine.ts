import {
  ActorOptions,
  AnyStateMachine,
  type ConditionalRequired,
  type IsNotNever,
  type RequiredOptions
} from 'xstate';
import { useActor } from './useActor';

/** @alias useActor */
export function useMachine<TMachine extends AnyStateMachine>(
  machine: TMachine,
  ...[options]: ConditionalRequired<
    [
      options?: ActorOptions<TMachine> & {
        [K in RequiredOptions<TMachine>]: unknown;
      }
    ],
    IsNotNever<RequiredOptions<TMachine>>
  >
) {
  return useActor(machine, options);
}
