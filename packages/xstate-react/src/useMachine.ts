import {
  Actor,
  ActorOptions,
  AnyStateMachine,
  StateFrom,
  type ConditionalRequired,
  type IsNotNever,
  type RequiredOptions
} from 'xstate';
import { useActor } from './useActor.ts';

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
): [StateFrom<TMachine>, Actor<TMachine>['send'], Actor<TMachine>] {
  return useActor(machine, options);
}
