import isDevelopment from '#is-development';
import { useCallback, useEffect } from 'react';
import { useSyncExternalStore } from 'use-sync-external-store/shim';
import {
  Actor,
  ActorOptions,
  AnyActorLogic,
  Snapshot,
  SnapshotFrom,
  type ConditionalRequired,
  type IsNotNever,
  type RequiredActorOptionsKeys
} from 'xstate';
import { stopRootWithRehydration } from './stopRootWithRehydration.ts';
import { useIdleActorRef } from './useActorRef.ts';

export function useActor<TLogic extends AnyActorLogic>(
  logic: TLogic,
  ...[options]: ConditionalRequired<
    [
      options?: ActorOptions<TLogic> & {
        [K in RequiredActorOptionsKeys<TLogic>]: unknown;
      }
    ],
    IsNotNever<RequiredActorOptionsKeys<TLogic>>
  >
): [SnapshotFrom<TLogic>, Actor<TLogic>['send'], Actor<TLogic>] {
  if (
    isDevelopment &&
    !!logic &&
    'send' in logic &&
    typeof logic.send === 'function'
  ) {
    throw new Error(
      `useActor() expects actor logic (e.g. a machine), but received an ActorRef. Use the useSelector(actorRef, ...) hook instead to read the ActorRef's snapshot.`
    );
  }

  const actorRef = useIdleActorRef(logic, options);

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

  useEffect(() => {
    actorRef.start();

    return () => {
      stopRootWithRehydration(actorRef);
    };
  }, [actorRef]);

  return [actorSnapshot, actorRef.send, actorRef];
}
