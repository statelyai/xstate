import { useEffect, useState } from 'react';
import useIsomorphicLayoutEffect from 'use-isomorphic-layout-effect';
import {
  Actor,
  ActorOptions,
  AnyActorLogic,
  AnyStateMachine,
  Observer,
  Snapshot,
  SnapshotFrom,
  createActor,
  toObserver
} from 'xstate';
import { stopRootWithRehydration } from './stopRootWithRehydration';

export function useIdleActorRef<TLogic extends AnyActorLogic>(
  logic: TLogic,
  options: Partial<ActorOptions<TLogic>>
): Actor<TLogic> {
  let [[currentConfig, actorRef], setCurrent] = useState(() => {
    const actorRef = createActor(logic, options);
    return [logic.config, actorRef];
  });

  if (logic.config !== currentConfig) {
    const newActorRef = createActor(logic, {
      ...options,
      snapshot: (actorRef.getPersistedSnapshot as any)({
        __unsafeAllowInlineActors: true
      })
    });
    setCurrent([logic.config, newActorRef]);
    actorRef = newActorRef;
  }

  // TODO: consider using `useAsapEffect` that would do this in `useInsertionEffect` is that's available
  useIsomorphicLayoutEffect(() => {
    (actorRef.logic as any as AnyStateMachine).implementations = (
      logic as any as AnyStateMachine
    ).implementations;
  });

  return actorRef;
}

const UNIQUE = {};

export function useActorRef<TLogic extends AnyActorLogic>(
  machine: TLogic,
  options: ActorOptions<TLogic> = {},
  observerOrListener?:
    | Observer<SnapshotFrom<TLogic>>
    | ((value: SnapshotFrom<TLogic>) => void)
): Actor<TLogic> {
  const actorRef = useIdleActorRef(machine, options);
  const [reactError, setReactError] = useState(() => {
    const initialSnapshot: Snapshot<any> = actorRef.getSnapshot();
    return initialSnapshot.status === 'error' ? initialSnapshot.error : UNIQUE;
  });

  if (reactError !== UNIQUE) {
    throw reactError;
  }

  useEffect(() => {
    const observer = toObserver(observerOrListener);
    const errorListener = observer.error;
    observer.error = (error) => {
      setReactError(error);
      errorListener?.(error);
    };
    let sub = actorRef.subscribe(observer);
    return () => {
      sub.unsubscribe();
    };
  }, [observerOrListener]);

  useEffect(() => {
    actorRef.start();

    return () => {
      stopRootWithRehydration(actorRef);
    };
  }, [actorRef]);

  return actorRef;
}
