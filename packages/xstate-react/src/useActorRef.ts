import isDevelopment from '#is-development';
import { useEffect, useRef, useState } from 'react';
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
  SnapshotFrom,
  TODO
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
    (actorRef.logic as AnyStateMachine).implementations = (
      machine as AnyStateMachine
    ).implementations;
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
        options?: InterpreterOptions<TLogic> &
          InternalMachineImplementations<
            TLogic['__TContext'],
            TLogic['__TEvent'],
            TODO,
            TODO,
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
  logic: TLogic,
  ...[options = {}, observerOrListener]: RestParams<TLogic>
): ActorRefFrom<TLogic> {
  const actorRefRef = useRef(interpret(logic, options) as AnyInterpreter);
  const [, setCount] = useState(0);

  useIsomorphicLayoutEffect(() => {
    (actorRefRef.current.logic as AnyStateMachine).implementations = (
      logic as unknown as AnyStateMachine
    ).implementations;
  });

  useEffect(() => {
    const sub = observerOrListener
      ? actorRefRef.current.subscribe(toObserver(observerOrListener))
      : undefined;

    actorRefRef.current.start();

    return () => {
      sub?.unsubscribe();
      actorRefRef.current.stop();
      actorRefRef.current = interpret(logic, options);
      setCount((c) => c + 1);
    };
  }, []);

  return actorRefRef.current as ActorRefFrom<TLogic>;
}
