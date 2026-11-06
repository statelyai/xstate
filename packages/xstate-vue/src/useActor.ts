import isDevelopment from '#is-development';
import { Ref } from 'vue';
import {
  Actor,
  ActorOptions,
  AnyActorLogic,
  SnapshotFrom,
  type ConditionalRequired,
  type IsNotNever,
  type RequiredActorOptionsKeys,
  type RequiredActorOptionsFor
} from 'xstate';
import { useActorRef } from './useActorRef.ts';
import { useSelector } from './useSelector.ts';

/**
 * Creates an actor from `logic`, or uses an already-created actor (e.g. from
 * `restoreActor`), and subscribes to its snapshot. Create a
 * passed actor once per component instance.
 *
 * @public
 */
export function useActor<TLogic extends AnyActorLogic>(
  actor: Actor<TLogic>
): {
  snapshot: Ref<SnapshotFrom<TLogic>>;
  send: Actor<TLogic>['send'];
  actorRef: Actor<TLogic>;
};
export function useActor<TLogic extends AnyActorLogic>(
  actorLogic: TLogic,
  ...[options]: ConditionalRequired<
    [options?: ActorOptions<TLogic> & RequiredActorOptionsFor<TLogic>],
    IsNotNever<RequiredActorOptionsKeys<TLogic>>
  >
): {
  snapshot: Ref<SnapshotFrom<TLogic>>;
  send: Actor<TLogic>['send'];
  actorRef: Actor<TLogic>;
};
export function useActor(
  actorLogic: AnyActorLogic | Actor<AnyActorLogic>,
  options: ActorOptions<any> = {}
) {
  const readyActor = actorLogic instanceof Actor;
  if (
    isDevelopment &&
    !readyActor &&
    'send' in actorLogic &&
    typeof actorLogic.send === 'function'
  ) {
    throw new Error(
      `useActor() expects actor logic (e.g. a machine), but received an ActorRef. Pass an Actor created with createActor()/restoreActor(), or use the useSelector(actorRef, ...) hook to read an ActorRef's snapshot.`
    );
  }

  const actorRef = readyActor
    ? useActorRef(actorLogic)
    : useActorRef(actorLogic, options);
  const snapshot = useSelector(actorRef, (s) => s);

  return {
    snapshot,
    send: actorRef.send,
    actorRef: actorRef
  };
}
