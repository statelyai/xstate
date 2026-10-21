import isDevelopment from '#is-development';
import { useEffect, useMemo, useRef, useState } from 'react';
import useIsomorphicLayoutEffect from 'use-isomorphic-layout-effect';
import {
  Actor,
  ActorOptions,
  AnyActorLogic,
  AnyStateMachine,
  Observer,
  SnapshotFrom,
  _hotSwapActorLogic as hotSwapActorLogic,
  createActor,
  _toObserver as toObserver,
  type ConditionalRequired,
  type IsNotNever,
  type RequiredActorOptionsKeys,
  type RequiredActorOptionsFor
} from 'xstate';

function isStateMachine(logic: AnyActorLogic): logic is AnyStateMachine {
  return (
    typeof (logic as any).provide === 'function' &&
    !!(logic as any).config &&
    !!(logic as any).sources
  );
}

// The hook updates the sources of its machine on later renders. A per-hook
// copy keeps those updates from reaching the caller's machine, which may be
// shared by other actors.
function ownLogic<TLogic extends AnyActorLogic>(logic: TLogic): TLogic {
  return isStateMachine(logic) ? (logic.provide({}) as any) : logic;
}

export function useIdleActorRef<TLogic extends AnyActorLogic>(
  logic: TLogic,
  ...[options]: ConditionalRequired<
    [options?: ActorOptions<TLogic> & RequiredActorOptionsFor<TLogic>],
    IsNotNever<RequiredActorOptionsKeys<TLogic>>
  >
): [Actor<TLogic>, (actorRef: Actor<TLogic>) => void] {
  const [actorRef, setActorRef] = useState(() => {
    return createActor(ownLogic(logic), options as ActorOptions<TLogic>);
  });
  // An object whose identity changes only when React Fast Refresh re-renders
  // this component. Fast Refresh ignores dependency lists while it applies an
  // update, so a `useMemo` with no dependencies recomputes during a refresh
  // and at no other time.
  const refreshSignal = useMemo(() => ({}), []);
  const refreshSignalRef = useRef(refreshSignal);

  // The logic passed on the first render is used for the hook's lifetime.
  // Later renders only contribute implementations provided with
  // `machine.provide()` for the same machine config.
  // TODO: consider using `useAsapEffect` that would do this in `useInsertionEffect` is that's available
  useIsomorphicLayoutEffect(() => {
    const currentLogic = actorRef.logic;
    const refreshed = refreshSignalRef.current !== refreshSignal;
    refreshSignalRef.current = refreshSignal;

    if ((logic as any).config === (currentLogic as any).config) {
      if (isStateMachine(logic) && isStateMachine(currentLogic)) {
        currentLogic.sources = logic.sources;
      }
      return;
    }

    // Development hot reloading: Fast Refresh re-evaluated the module that
    // defines the machine. Keep the running actor and carry its live snapshot
    // over to the new machine; start a fresh actor if it cannot be carried.
    if (isDevelopment && refreshed) {
      const nextLogic = ownLogic(logic);
      if (!hotSwapActorLogic(actorRef, nextLogic as any as AnyStateMachine)) {
        setActorRef(createActor(nextLogic, options as ActorOptions<TLogic>));
      }
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
        options: ActorOptions<TLogic> & RequiredActorOptionsFor<TLogic>,
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
