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
  const optionsRef = useRef(options);
  optionsRef.current = options;

  let [actorRef, setActorRef] = useState(() => {
    return createActor(logic, options);
  });

  if (logic.config !== (actorRef.logic as any).config) {
    const newActorRef = createActor(logic, {
      ...options,
      snapshot: (actorRef.getPersistedSnapshot as any)({
        __unsafeAllowInlineActors: true
      })
    });
    setActorRef(newActorRef);
    actorRef = newActorRef;
  }

  // TODO: consider using `useAsapEffect` that would do this in `useInsertionEffect` is that's available
  useIsomorphicLayoutEffect(() => {
    (actorRef.logic as any as AnyStateMachine).implementations = (
      logic as any as AnyStateMachine
    ).implementations;
  });

  return [actorRef, setActorRef];
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
  }, [observerOrListener]);

  useEffect(() => {
    // If the actor was stopped by a previous cleanup (e.g. strict mode),
    // create a fresh actor. The setActorRef triggers a re-render so
    // useSyncExternalStore re-subscribes to the new actor.
    // Only recreate if externally stopped ('stopped' status from XSTATE_STOP),
    // not if it completed naturally ('done'/'error' status).
    if (
      (actorRef as any)._processingStatus ===
        2 /* ProcessingStatus.Stopped */ &&
      (actorRef.getSnapshot() as any)?.status === 'stopped'
    ) {
      const newActor = createActor(machine, actorRef.options) as Actor<TLogic>;
      newActor.start();
      setActorRef(newActor);
      // No cleanup — the re-render will run this effect again with the
      // new actorRef (which is Running), registering the stop cleanup then.
      return;
    }
    actorRef.start();
    return () => {
      actorRef.stop();
    };
  }, [actorRef]);

  return actorRef;
}
