import { useEffect, useState } from 'react';
import useIsomorphicLayoutEffect from 'use-isomorphic-layout-effect';
import {
  Actor,
  ActorOptions,
  AnyActorLogic,
  AnyStateMachine,
  Observer,
  SnapshotFrom,
  createActor,
  toObserver,
  type ConditionalRequired,
  type IsNotNever,
  type RequiredActorOptionsKeys
} from 'xstate';
import { stopRootWithRehydration } from './stopRootWithRehydration';

export function useIdleActorRef<TLogic extends AnyActorLogic>(
  logic: TLogic,
  ...[options]: ConditionalRequired<
    [
      options?: ActorOptions<TLogic> & {
        [K in RequiredActorOptionsKeys<TLogic>]: unknown;
      }
    ],
    IsNotNever<RequiredActorOptionsKeys<TLogic>>
  >
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

export function useActorRef<TLogic extends AnyActorLogic>(
  machine: TLogic,
  ...[options, observerOrListener]: IsNotNever<
    RequiredActorOptionsKeys<TLogic>
  > extends true
    ? [
        options: ActorOptions<TLogic> & {
          [K in RequiredActorOptionsKeys<TLogic>]: unknown;
        },
        observerOrListener?:
          | Observer<SnapshotFrom<TLogic>>
          | ((value: SnapshotFrom<TLogic>) => void)
      ]
    : [
        options?: ActorOptions<TLogic>,
        observerOrListener?:
          | Observer<SnapshotFrom<TLogic>>
          | ((value: SnapshotFrom<TLogic>) => void)
      ]
): Actor<TLogic> {
  const actorRef = useIdleActorRef(machine, options);

  useEffect(() => {
    if (!observerOrListener) {
      return;
    }
    const sub = actorRef.subscribe(toObserver(observerOrListener));
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
