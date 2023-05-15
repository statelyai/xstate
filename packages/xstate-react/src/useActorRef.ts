import isDevelopment from '#is-development';
import { useEffect, useState } from 'react';
import {
  AnyActorBehavior,
  AnyInterpreter,
  AnyStateMachine,
  AreAllImplementationsAssumedToBeProvided,
  InternalMachineImplementations,
  interpret,
  ActorRefFrom,
  InterpreterOptions,
  InterpreterStatus,
  Observer,
  StateFrom,
  toObserver,
  SnapshotFrom
} from 'xstate';
import useConstant from './useConstant.ts';
import useIsomorphicLayoutEffect from 'use-isomorphic-layout-effect';

export function useIdleInterpreter(
  machine: AnyActorBehavior,
  options: Partial<InterpreterOptions<AnyActorBehavior>>
): AnyInterpreter {
  if (isDevelopment) {
    const [initialMachine] = useState(machine);

    if (machine.config !== initialMachine.config) {
      console.warn(
        `Actor logic has changed between renders. This is not supported and may lead to invalid snapshots.`
      );
    }
  }

  const actorRef = useConstant(() => {
    return interpret(machine as AnyStateMachine, options);
  });

  // TODO: consider using `useAsapEffect` that would do this in `useInsertionEffect` is that's available
  useIsomorphicLayoutEffect(() => {
    (actorRef.behavior as AnyStateMachine).options = (
      machine as AnyStateMachine
    ).options;
  });

  return actorRef as any;
}

type RestParams<TBehavior extends AnyActorBehavior> =
  TBehavior extends AnyStateMachine
    ? AreAllImplementationsAssumedToBeProvided<
        TBehavior['__TResolvedTypesMeta']
      > extends false
      ? [
          options: InterpreterOptions<TBehavior> &
            InternalMachineImplementations<
              TBehavior['__TContext'],
              TBehavior['__TEvent'],
              TBehavior['__TResolvedTypesMeta'],
              true
            >,
          observerOrListener?:
            | Observer<StateFrom<TBehavior>>
            | ((value: StateFrom<TBehavior>) => void)
        ]
      : [
          options?: InterpreterOptions<TBehavior> &
            InternalMachineImplementations<
              TBehavior['__TContext'],
              TBehavior['__TEvent'],
              TBehavior['__TResolvedTypesMeta']
            >,
          observerOrListener?:
            | Observer<StateFrom<TBehavior>>
            | ((value: StateFrom<TBehavior>) => void)
        ]
    : [
        options?: InterpreterOptions<TBehavior>,
        observerOrListener?:
          | Observer<SnapshotFrom<TBehavior>>
          | ((value: SnapshotFrom<TBehavior>) => void)
      ];

export function useActorRef<TBehavior extends AnyActorBehavior>(
  machine: TBehavior,
  ...[options = {}, observerOrListener]: RestParams<TBehavior>
): ActorRefFrom<TBehavior> {
  const service = useIdleInterpreter(machine, options);

  useEffect(() => {
    if (!observerOrListener) {
      return;
    }
    let sub = service.subscribe(toObserver(observerOrListener));
    return () => {
      sub.unsubscribe();
    };
  }, [observerOrListener]);

  useEffect(() => {
    service.start();

    return () => {
      service.stop();
      service.status = InterpreterStatus.NotStarted;
      (service as any)._initState();
    };
  }, []);

  return service as any;
}
