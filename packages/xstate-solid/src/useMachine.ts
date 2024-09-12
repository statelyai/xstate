import type {
  ActorOptions,
  AnyStateMachine,
  ConditionalRequired,
  IsNotNever,
  RequiredActorOptionsKeys
} from 'xstate';
import { useActor } from './useActor.ts';

/** @alias useActor */
export function useMachine<TMachine extends AnyStateMachine>(
  machine: TMachine,
  ...[options]: ConditionalRequired<
    [
      options?: ActorOptions<TMachine> & {
        [K in RequiredActorOptionsKeys<TMachine>]: unknown;
      }
    ],
    IsNotNever<RequiredActorOptionsKeys<TMachine>>
  >
) {
  return useActor(machine, options);
}
