import {
  ActorOptions,
  AnyStateMachine,
  type ConditionalRequired,
  type IsNotNever,
  type RequiredActorInstanceOptions
} from 'xstate';
import { useActor } from './useActor';

/** @alias useActor */
export function useMachine<TMachine extends AnyStateMachine>(
  machine: TMachine,
  ...[options]: ConditionalRequired<
    [
      options?: ActorOptions<TMachine> & {
        [K in RequiredActorInstanceOptions<TMachine>]: unknown;
      }
    ],
    IsNotNever<RequiredActorInstanceOptions<TMachine>>
  >
) {
  return useActor(machine, options);
}
