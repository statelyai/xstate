import isDevelopment from '#is-development';
import { useCallback } from 'react';
import { useSyncExternalStore } from 'use-sync-external-store/shim';
import {
  Actor,
  ActorOptions,
  AnyActorLogic,
  Snapshot,
  SnapshotFrom,
  createActor,
  type ConditionalRequired,
  type IsNotNever,
  type RequiredActorOptionsKeys,
  type RequiredActorOptionsFor
} from 'xstate';
import { isActor, useActorLifecycle, useIdleActorRef } from './useActorRef.ts';

/**
 * Creates an actor from `logic` (or uses an already-created `actor`, e.g. from
 * `restoreActor`) and subscribes to its snapshot. Create a passed actor once,
 * e.g. `useState(() => restoreActor(machine, persisted))[0]`.
 *
 * @public
 */
export function useActor<TLogic extends AnyActorLogic>(
  actor: Actor<TLogic>
): [SnapshotFrom<TLogic>, Actor<TLogic>['send'], Actor<TLogic>];
export function useActor<TLogic extends AnyActorLogic>(
  logic: TLogic,
  ...[options]: ConditionalRequired<
    [options?: ActorOptions<TLogic> & RequiredActorOptionsFor<TLogic>],
    IsNotNever<RequiredActorOptionsKeys<TLogic>>
  >
): [SnapshotFrom<TLogic>, Actor<TLogic>['send'], Actor<TLogic>];
export function useActor<TLogic extends AnyActorLogic>(
  logic: TLogic | Actor<TLogic>,
  options?: ActorOptions<TLogic>
): [SnapshotFrom<TLogic>, Actor<TLogic>['send'], Actor<TLogic>] {
  const readyActor = isActor(logic);
  if (
    isDevelopment &&
    !readyActor &&
    !!logic &&
    'send' in logic &&
    typeof logic.send === 'function'
  ) {
    throw new Error(
      `useActor() expects actor logic (e.g. a machine), but received an ActorRef. Pass an Actor created with createActor()/restoreActor(), or use the useSelector(actorRef, ...) hook to read an ActorRef's snapshot.`
    );
  }

  const [actorRef, setActorRef] = useIdleActorRef(
    logic,
    ...([options] as [ActorOptions<TLogic>])
  );

  const getSnapshot = useCallback(() => {
    return actorRef.getSnapshot();
  }, [actorRef]);

  const subscribe = useCallback(
    (handleStoreChange: () => void) => {
      const { unsubscribe } = actorRef.subscribe({
        next: handleStoreChange,
        error: handleStoreChange
      });
      return unsubscribe;
    },
    [actorRef]
  );

  const actorSnapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot
  );

  const snapshotWithStatus =
    'status' in actorSnapshot
      ? (actorSnapshot as Snapshot<unknown>)
      : undefined;
  if (snapshotWithStatus?.status === 'error') {
    throw snapshotWithStatus.error;
  }

  useActorLifecycle(actorRef, setActorRef, () =>
    createActor(
      actorRef.logic,
      readyActor ? actorRef.options : (options as ActorOptions<TLogic>)
    )
  );

  return [actorSnapshot, actorRef.send, actorRef];
}
