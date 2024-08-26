import type {
  ActorOptions,
  AnyStateMachine,
  ConditionalRequired,
  IsNotNever,
  RequiredActorInstanceOptions
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
) {
  return useActor(machine, options);
}
