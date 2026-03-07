import { Ref } from 'vue';
import {
  Actor,
  ActorOptions,
  AnyStateMachine,
  SnapshotFrom,
  type ConditionalRequired,
  type IsNotNever,
  type RequiredActorOptionsKeys
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
): {
  snapshot: Ref<SnapshotFrom<TMachine>>;
  send: Actor<TMachine>['send'];
  actorRef: Actor<TMachine>;
} {
  return useActor(machine, options);
}
