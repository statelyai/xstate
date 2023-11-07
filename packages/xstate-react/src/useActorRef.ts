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
  const [[currentConfig, actorRef], setCurrent] = useState(() => {
    const actorRef = createActor(logic, options);
    return [logic.config, actorRef];
  });

  if (logic.config !== currentConfig) {
    const newActorRef = createActor(logic, {
      ...options,
      state: actorRef.getPersistedState()
    });
    setCurrent([logic.config, newActorRef]);
  }

  // TODO: consider using `useAsapEffect` that would do this in `useInsertionEffect` is that's available
  useIsomorphicLayoutEffect(() => {
    (actorRef.logic as AnyStateMachine).implementations = (
      logic as AnyStateMachine
    ).implementations;
  });

  return actorRef;
}

type RestParams<TLogic extends AnyActorLogic> = TLogic extends AnyStateMachine
  ? AreAllImplementationsAssumedToBeProvided<
      TLogic['__TResolvedTypesMeta']
    > extends false
    ? [
        options: ActorOptions<TLogic> &
          InternalMachineImplementations<
            TLogic['__TContext'],
            TLogic['__TEvent'],
            TODO,
            TODO,
            TODO,
            TLogic['__TResolvedTypesMeta'],
            true
          >,
        observerOrListener?:
          | Observer<StateFrom<TLogic>>
          | ((value: StateFrom<TLogic>) => void)
      ]
    : [
        options?: ActorOptions<TLogic> &
          InternalMachineImplementations<
            TLogic['__TContext'],
            TLogic['__TEvent'],
            TODO,
            TODO,
            TODO,
            TLogic['__TResolvedTypesMeta']
          >,
        observerOrListener?:
          | Observer<StateFrom<TLogic>>
          | ((value: StateFrom<TLogic>) => void)
      ]
  : [
      options?: ActorOptions<TLogic>,
      observerOrListener?:
        | Observer<SnapshotFrom<TLogic>>
        | ((value: SnapshotFrom<TLogic>) => void)
    ];

export function useActorRef<TLogic extends AnyActorLogic>(
  machine: TLogic,
  ...[options = {}, observerOrListener]: RestParams<TLogic>
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
