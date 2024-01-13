import isDevelopment from '#is-development';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSyncExternalStore } from 'use-sync-external-store/shim';
import {
  Actor,
  ActorOptions,
  ActorRefFrom,
  AnyActorLogic,
  AnyStateMachine,
  SnapshotFrom,
  createActor
} from 'xstate';
import { stopRootWithRehydration } from './stopRootWithRehydration.ts';
import { useIdleActorRef } from './useActorRef.ts';
import { useSelector } from './useSelector.ts';

export function useActor<TLogic extends AnyActorLogic>(
  logic: TLogic,
  options: ActorOptions<TLogic> = {}
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
      stopRootWithRehydration(actorRef);
    };
  }, [actorRef]);

  return [actorSnapshot, actorRef.send, actorRef];
}

export function useActor2<T extends AnyActorLogic>(
  logic: T,
  options: ActorOptions<T> = {}
): [SnapshotFrom<T>, Actor<T>['send'], Actor<T>] {
  const actorRefRef = useRef<Actor<T>>();
  if (!actorRefRef.current) {
    actorRefRef.current = createActor(logic, options);
  }
  // force update
  const updater = useForceUpdate();

  actorRefRef.current.logic.implementations = (
    logic as AnyStateMachine
  ).implementations;

  useEffect(() => {
    actorRefRef.current!.start();

    return () => {
      actorRefRef.current!.stop();
      actorRefRef.current = createActor(logic, options);
      // updater();
    };
  }, []);

  const send = useCallback((event) => {
    actorRefRef.current!.send(event);
  }, []);

  const snapshot = useSelector(actorRefRef.current, (state) => state);

  return [snapshot, send, actorRefRef.current];
}

function useForceUpdate() {
  const [, setTick] = useState(0);
  const update = () => {
    setTick((tick) => tick + 1);
  };
  return update;
}
