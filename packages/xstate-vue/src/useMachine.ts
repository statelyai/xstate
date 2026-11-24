import { Ref } from 'vue';
import {
  Actor,
  ActorOptions,
  AnyStateMachine,
  SnapshotFrom,
  type ConditionalRequired,
  type IsNotNever,
  type RequiredActorOptionsKeys,
  type RequiredActorOptionsFor
} from 'xstate';
import { useActor } from './useActor.ts';

/**
 * @alias useActor
 *
 * @public
 */
export function useMachine<TMachine extends AnyStateMachine>(
  actor: Actor<TMachine>
): {
  snapshot: Ref<SnapshotFrom<TMachine>>;
  send: Actor<TMachine>['send'];
  actorRef: Actor<TMachine>;
};
export function useMachine<TMachine extends AnyStateMachine>(
  machine: TMachine,
  ...[options]: ConditionalRequired<
    [options?: ActorOptions<TMachine> & RequiredActorOptionsFor<TMachine>],
    IsNotNever<RequiredActorOptionsKeys<TMachine>>
  >
): {
  snapshot: Ref<SnapshotFrom<TMachine>>;
  send: Actor<TMachine>['send'];
  actorRef: Actor<TMachine>;
};
export function useMachine(
  machine: AnyStateMachine | Actor<AnyStateMachine>,
  options?: ActorOptions<AnyStateMachine>
) {
  return (useActor as any)(machine, options);
}
