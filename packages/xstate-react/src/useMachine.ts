import {
  Actor,
  ActorOptions,
  AnyStateMachine,
  StateFrom,
  type ConditionalRequired,
  type IsNotNever,
  type RequiredActorInstanceOptions
} from 'xstate';
import { useActor } from './useActor.ts';

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
): [StateFrom<TMachine>, Actor<TMachine>['send'], Actor<TMachine>] {
  return useActor(machine, options);
}
