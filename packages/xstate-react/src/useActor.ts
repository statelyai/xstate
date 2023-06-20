import isDevelopment from '#is-development';
import { useCallback, useEffect } from 'react';
import { useSyncExternalStore } from 'use-sync-external-store/shim';
import {
  ActorRefFrom,
  AnyActorLogic,
  InterpreterOptions,
  InterpreterStatus,
  SnapshotFrom
} from 'xstate';
import { useIdleInterpreter } from './useActorRef.ts';
import { isActorRef } from 'xstate/actors';

export function useActor<TLogic extends AnyActorLogic>(
  logic: TLogic,
  options: InterpreterOptions<TLogic> = {}
): [SnapshotFrom<TLogic>, ActorRefFrom<TLogic>['send'], ActorRefFrom<TLogic>] {
  if (isDevelopment && isActorRef(logic)) {
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
      actorRef.status = InterpreterStatus.NotStarted;
      (actorRef as any)._initState();
    };
  }, [actorRef]);

  return [actorSnapshot, actorRef.send, actorRef] as any;
}
