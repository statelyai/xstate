import { Readable, readable } from 'svelte/store';
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
  snapshot: Readable<SnapshotFrom<TLogic>>;
  send: Actor<TLogic>['send'];
  actorRef: Actor<TLogic>;
};
export function useActor<TLogic extends AnyActorLogic>(
  logic: TLogic,
  ...[options]: ConditionalRequired<
    [options?: ActorOptions<TLogic> & RequiredActorOptionsFor<TLogic>],
    IsNotNever<RequiredActorOptionsKeys<TLogic>>
  >
): {
  snapshot: Readable<SnapshotFrom<TLogic>>;
  send: Actor<TLogic>['send'];
  actorRef: Actor<TLogic>;
};
export function useActor<TLogic extends AnyActorLogic>(
  logic: TLogic | Actor<TLogic>,
  options?: ActorOptions<TLogic>
): {
  snapshot: Readable<SnapshotFrom<TLogic>>;
  send: Actor<TLogic>['send'];
  actorRef: Actor<TLogic>;
} {
  const actorRef = (useActorRef as any)(logic, options) as Actor<TLogic>;

  let currentSnapshot = actorRef.getSnapshot();

  const snapshot = readable(currentSnapshot, (set) => {
    currentSnapshot = actorRef.getSnapshot();
    set(currentSnapshot);
    return actorRef.subscribe((nextSnapshot) => {
      if (currentSnapshot !== nextSnapshot) {
        currentSnapshot = nextSnapshot;
        set(currentSnapshot);
      }
    }).unsubscribe;
  });

  return { snapshot, send: actorRef.send, actorRef };
}
