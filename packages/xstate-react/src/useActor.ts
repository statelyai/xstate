import isDevelopment from '#is-development';
import { useCallback, useEffect } from 'react';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector';
import {
  ActorRefFrom,
  AnyActorLogic,
  AnyState,
  InterpreterOptions,
  InterpreterStatus,
  SnapshotFrom
} from 'xstate';
import { useIdleInterpreter } from './useActorRef.ts';
import { isActorRef } from 'xstate/actors';

function identity<T>(a: T): T {
  return a;
}

const isEqual = (prevState: AnyState, nextState: AnyState) => {
  return prevState === nextState || nextState.changed === false;
};

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

  const actorSnapshot = useSyncExternalStoreWithSelector(
    subscribe,
    getSnapshot,
    getSnapshot,
    identity,
    isEqual
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
