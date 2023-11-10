import { useEffect, useState } from 'react';
import {
  AnyActorLogic,
  AnyActor,
  AnyStateMachine,
  AreAllImplementationsAssumedToBeProvided,
  InternalMachineImplementations,
  createActor,
  ActorRefFrom,
  ActorOptions,
  Observer,
  StateFrom,
  toObserver,
  SnapshotFrom,
  TODO
} from 'xstate';
import useIsomorphicLayoutEffect from 'use-isomorphic-layout-effect';
import { stopRootWithRehydration } from './stopRootWithRehydration';

export function useIdleActor(
  logic: AnyActorLogic,
  options: Partial<ActorOptions<AnyActorLogic>>
): AnyActor {
  let [[currentConfig, actorRef], setCurrent] = useState(() => {
    const actorRef = createActor(logic, options);
    return [logic.config, actorRef];
  });

  if (logic.config !== currentConfig) {
    const newActorRef = createActor(logic, {
      ...options,
      state: (actorRef.getPersistedState as any)({
        __unsafeAllowInlineActors: true
      })
    });
    setCurrent([logic.config, newActorRef]);
    actorRef = newActorRef;
  }

  // TODO: consider using `useAsapEffect` that would do this in `useInsertionEffect` is that's available
  useIsomorphicLayoutEffect(() => {
    (actorRef.logic as AnyStateMachine).implementations = (
      logic as AnyStateMachine
    ).implementations;
  });

  return actorRef;
}

export function useActorRef<TLogic extends AnyActorLogic>(
  machine: TLogic,
  options: ActorOptions<TLogic> = {},
  observerOrListener?:
    | Observer<SnapshotFrom<TLogic>>
    | ((value: SnapshotFrom<TLogic>) => void)
): ActorRefFrom<TLogic> {
  const actorRef = useIdleActor(machine, options);

  useEffect(() => {
    if (!observerOrListener) {
      return;
    }
    let sub = actorRef.subscribe(toObserver(observerOrListener));
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

  return actorRef as any;
}
