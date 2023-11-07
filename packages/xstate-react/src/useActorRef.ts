import isDevelopment from '#is-development';
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
import useConstant from './useConstant.ts';
import useIsomorphicLayoutEffect from 'use-isomorphic-layout-effect';

export function useIdleInterpreter(
  machine: AnyActorLogic,
  options: Partial<ActorOptions<AnyActorLogic>>
): AnyActor {
  if (isDevelopment) {
    const [initialMachine] = useState(machine);

    if (machine.config !== initialMachine.config) {
      console.warn(
        `Actor logic has changed between renders. This is not supported and may lead to invalid snapshots.`
      );
    }
  }

  const actorRef = useConstant(() => {
    return createActor(machine as AnyStateMachine, options);
  });

  // TODO: consider using `useAsapEffect` that would do this in `useInsertionEffect` is that's available
  useIsomorphicLayoutEffect(() => {
    (actorRef.logic as AnyStateMachine).implementations = (
      machine as AnyStateMachine
    ).implementations;
  });

  return actorRef as any;
}

export function useActorRef<TLogic extends AnyActorLogic>(
  machine: TLogic,
  options: ActorOptions<TLogic> = {},
  observerOrListener?:
    | Observer<SnapshotFrom<TLogic>>
    | ((value: SnapshotFrom<TLogic>) => void)
): ActorRefFrom<TLogic> {
  const actorRef = useIdleInterpreter(machine, options);

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
      actorRef.stop();
      (actorRef as any)._processingStatus = 0;
      (actorRef as any)._initState();
    };
  }, []);

  return actorRef as any;
}
