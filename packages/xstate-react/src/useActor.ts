import isDevelopment from '#is-development';
import { useCallback, useEffect } from 'react';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector';
import {
  ActorRefFrom,
  AnyActorBehavior,
  AnyState,
  InterpreterOptions,
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

export function useActor<TBehavior extends AnyActorBehavior>(
  behavior: TBehavior,
  options: InterpreterOptions<TBehavior> = {}
): [
  SnapshotFrom<TBehavior>,
  ActorRefFrom<TBehavior>['send'],
  ActorRefFrom<TBehavior>
] {
  if (isDevelopment && isActorRef(behavior)) {
    throw new Error(
      `useActor() expects actor logic (e.g. a machine), but received an ActorRef. Use the useSelector(actorRef, ...) hook instead to read the ActorRef's snapshot.`
    );
  }

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
      actorRef.reset();
    };
  }, [actorRef]);

  return [actorSnapshot, actorRef.send, actorRef] as any;
}
