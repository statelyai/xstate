import { useCallback, useEffect, useState } from 'react';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector';
import {
  ActorRefFrom,
  AnyActorBehavior,
  AnyState,
  InterpreterOptions,
  InterpreterStatus,
  SnapshotFrom
} from 'xstate';
import { useIdleInterpreter } from './useActorRef.ts';

function identity<T>(a: T): T {
  return a;
}

const isEqual = (prevState: AnyState, nextState: AnyState) => {
  return prevState === nextState || nextState.changed === false;
};

export function useActor<TBehavior extends AnyActorBehavior>(
  behavior: TBehavior,
  options: InterpreterOptions<TBehavior> = {}
): [
  SnapshotFrom<TBehavior>,
  ActorRefFrom<TBehavior>['send'],
  ActorRefFrom<TBehavior>
] {
  const actorRef = useIdleInterpreter(behavior, options as any);

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
