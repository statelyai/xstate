import isDevelopment from '#is-development';
import { useEffect, useState } from 'react';
import {
  AnyActorLogic,
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
  machine: AnyActorLogic,
  options: Partial<InterpreterOptions<AnyActorLogic>>
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
    (actorRef.logic as AnyStateMachine).options = (
      machine as AnyStateMachine
    ).options;
  });

  return actorRef as any;
}

type RestParams<TLogic extends AnyActorLogic> = TLogic extends AnyStateMachine
  ? AreAllImplementationsAssumedToBeProvided<
      TLogic['__TResolvedTypesMeta']
    > extends false
    ? [
        options: InterpreterOptions<TLogic> &
          InternalMachineImplementations<
            TLogic['__TContext'],
            TLogic['__TEvent'],
            TLogic['__TResolvedTypesMeta'],
            true
          >,
        observerOrListener?:
          | Observer<StateFrom<TLogic>>
          | ((value: StateFrom<TLogic>) => void)
      ]
    : [
        options?: InterpreterOptions<TLogic> &
          InternalMachineImplementations<
            TLogic['__TContext'],
            TLogic['__TEvent'],
            TLogic['__TResolvedTypesMeta']
          >,
        observerOrListener?:
          | Observer<StateFrom<TLogic>>
          | ((value: StateFrom<TLogic>) => void)
      ]
  : [
      options?: InterpreterOptions<TLogic>,
      observerOrListener?:
        | Observer<SnapshotFrom<TLogic>>
        | ((value: SnapshotFrom<TLogic>) => void)
    ];

export function useActorRef<TLogic extends AnyActorLogic>(
  machine: TLogic,
  ...[options = {}, observerOrListener]: RestParams<TLogic>
): ActorRefFrom<TLogic> {
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
