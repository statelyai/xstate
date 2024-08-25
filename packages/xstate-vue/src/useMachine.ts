import { Ref } from 'vue';
import {
  Actor,
  ActorOptions,
  AnyStateMachine,
  EventFromLogic,
  SnapshotFrom,
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
): {
  snapshot: Ref<SnapshotFrom<TMachine>>;
  send: (event: EventFromLogic<TMachine>) => void;
  actorRef: Actor<TMachine>;
} {
  return useActor(machine, options);
}
