import type {
  ActorOptions,
  AnyStateMachine,
  ConditionalRequired,
  IsNotNever,
  RequiredActorOptionsKeys,
  RequiredActorOptionsFor
} from 'xstate';
import { useActor } from './useActor.ts';

/** @alias useActor */
export function useMachine<TMachine extends AnyStateMachine>(
  machine: TMachine,
  ...[options]: ConditionalRequired<
    [options?: ActorOptions<TMachine> & RequiredActorOptionsFor<TMachine>],
    IsNotNever<RequiredActorOptionsKeys<TMachine>>
  >
) {
  return useActor(machine, options);
}
