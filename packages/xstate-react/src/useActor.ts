import isDevelopment from '#is-development';
import { useCallback, useEffect } from 'react';
import { useSyncExternalStore } from 'use-sync-external-store/shim';
import {
  ActorRefFrom,
  AnyActorLogic,
  ActorOptions,
  ActorStatus,
  SnapshotFrom
} from 'xstate';
import { useIdleInterpreter } from './useActorRef.ts';

export function useActor<TLogic extends AnyActorLogic>(
  logic: TLogic,
  options: ActorOptions<TLogic> = {}
): [SnapshotFrom<TLogic>, ActorRefFrom<TLogic>['send'], ActorRefFrom<TLogic>] {
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

  const actorRef = useIdleInterpreter(logic, options as any);

  const getSnapshot = useCallback(() => {
    return actorRef.getSnapshot();
  }, [actorRef]);

  const subscribe = useCallback(
    (handleStoreChange) => {
      const { unsubscribe } = actorRef.subscribe(handleStoreChange);
      return unsubscribe;
    },
    [actorRef]
  );

  const actorSnapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot
  );

  useEffect(() => {
    actorRef.start();

    return () => {
      actorRef.stop();
      actorRef.status = ActorStatus.NotStarted;
      (actorRef as any)._initState();
    };
  }, [actorRef]);

  return [actorSnapshot, actorRef.send, actorRef] as any;
}
