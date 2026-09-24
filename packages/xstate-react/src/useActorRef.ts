import { useEffect, useRef, useState } from 'react';
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
): [Actor<TLogic>, (actorRef: Actor<TLogic>) => void] {
  const [actorRef, setActorRef] = useState(() => {
    return createActor(logic, options);
  });

  // The logic passed on the first render is used for the hook's lifetime.
  // Later renders only contribute implementations provided with
  // `machine.provide()` for the same machine config.
  // TODO: consider using `useAsapEffect` that would do this in `useInsertionEffect` is that's available
  useIsomorphicLayoutEffect(() => {
    const currentLogic = actorRef.logic as any as AnyStateMachine;
    if (logic.config === currentLogic.config) {
      currentLogic.sources = (logic as any as AnyStateMachine).sources;
    }
  });

  return [actorRef, setActorRef];
}

export function useActorLifecycle<TLogic extends AnyActorLogic>(
  actorRef: Actor<TLogic>,
  setActorRef: (actorRef: Actor<TLogic>) => void,
  createReplacement: () => Actor<TLogic>
): void {
  const pendingStopsRef = useRef(new Map<Actor<TLogic>, () => void>());

  useEffect(() => {
    const cancelPendingStop = pendingStopsRef.current.get(actorRef);
    if (cancelPendingStop) {
      cancelPendingStop();
      pendingStopsRef.current.delete(actorRef);
    }

    // If the actor was stopped before this effect reconnected, create a fresh
    // actor. A stopped actor cannot be restarted.
    if (
      (actorRef as any)._processingStatus ===
        2 /* ProcessingStatus.Stopped */ &&
      (actorRef.getSnapshot() as any)?.status === 'stopped'
    ) {
      const newActor = createReplacement();
      setActorRef(newActor);
      return;
    }

    actorRef.start();
    return () => {
      let canceled = false;
      const cancel = () => {
        canceled = true;
      };
      pendingStopsRef.current.set(actorRef, cancel);

      queueMicrotask(() => {
        if (!canceled) {
          actorRef.stop();
        }
        if (pendingStopsRef.current.get(actorRef) === cancel) {
          pendingStopsRef.current.delete(actorRef);
        }
      });
    };
  }, [actorRef]);
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
  const [actorRef, setActorRef] = useIdleActorRef(machine, options);

  useEffect(() => {
    if (!observerOrListener) {
      return;
    }
    const sub = actorRef.subscribe(toObserver(observerOrListener));
    return () => {
      sub.unsubscribe();
    };
  }, [actorRef, observerOrListener]);

  useActorLifecycle(actorRef, setActorRef, () =>
    createActor(actorRef.logic, actorRef.options)
  );

  return actorRef;
}
