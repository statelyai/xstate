import type { Accessor } from 'solid-js';
import type {
  Actor,
  ActorRefFrom,
  EventFromLogic,
  SnapshotFrom,
  ActorOptions,
  AnyStateMachine,
  ConditionalRequired,
  IsNotNever,
  RequiredActorOptionsKeys,
  RequiredActorOptionsFor
} from 'xstate';
import { useActor } from './useActor.ts';

/**
 * @alias useActor
 *
 * @public
 */
export function useMachine<TMachine extends AnyStateMachine>(
  actor: () => Actor<TMachine>
): [
  SnapshotFrom<TMachine>,
  (event: EventFromLogic<TMachine>) => void,
  Accessor<ActorRefFrom<TMachine>>
];
export function useMachine<TMachine extends AnyStateMachine>(
  actor: Actor<TMachine>
): ReturnType<typeof useActor<TMachine>>;
export function useMachine<TMachine extends AnyStateMachine>(
  machine: TMachine,
  ...[options]: ConditionalRequired<
    [options?: ActorOptions<TMachine> & RequiredActorOptionsFor<TMachine>],
    IsNotNever<RequiredActorOptionsKeys<TMachine>>
  >
): ReturnType<typeof useActor<TMachine>>;
export function useMachine(
  machine:
    | AnyStateMachine
    | Actor<AnyStateMachine>
    | (() => Actor<AnyStateMachine>),
  options?: ActorOptions<AnyStateMachine>
) {
  return (useActor as any)(machine, options);
}
