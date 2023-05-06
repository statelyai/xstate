import { useEffect, useState } from 'react';
import {
  AnyInterpreter,
  AnyStateMachine,
  AreAllImplementationsAssumedToBeProvided,
  InternalMachineImplementations,
  interpret,
  ActorRefFrom,
  SnapshotFrom,
  InterpreterOptions,
  InterpreterStatus,
  Observer,
  StateFrom,
  toObserver,
  AnyActorBehavior
} from 'xstate';
import useConstant from './useConstant.ts';
import useIsomorphicLayoutEffect from 'use-isomorphic-layout-effect';

export function useIdleInterpreter(
  behavior: AnyActorBehavior,
  options: Partial<InterpreterOptions<AnyActorBehavior>>
): AnyInterpreter {
  if (process.env.NODE_ENV !== 'production') {
    const [initialBehavior] = useState(behavior);

    if (behavior.config !== initialBehavior.config) {
      console.warn(
        'Machine given to `useMachine` has changed between renders. This is not supported and might lead to unexpected results.\n' +
          'Please make sure that you pass the same Machine as argument each time.'
      );
    }
  }

  const service = useConstant(() => {
    return interpret(behavior as AnyActorBehavior, options);
  });

  // TODO: consider using `useAsapEffect` that would do this in `useInsertionEffect` is that's available
  useIsomorphicLayoutEffect(() => {
    (service.behavior as AnyActorBehavior).options = behavior.options;
  });

  return service as any;
}

type RestParams<TMachine extends AnyStateMachine> =
  AreAllImplementationsAssumedToBeProvided<
    TMachine['__TResolvedTypesMeta']
  > extends false
    ? [
        options: InterpreterOptions<TMachine> &
          InternalMachineImplementations<
            TMachine['__TContext'],
            TMachine['__TEvent'],
            TMachine['__TResolvedTypesMeta'],
            true
          >,
        observerOrListener?:
          | Observer<StateFrom<TMachine>>
          | ((value: StateFrom<TMachine>) => void)
      ]
    : [
        options?: InterpreterOptions<TMachine> &
          InternalMachineImplementations<
            TMachine['__TContext'],
            TMachine['__TEvent'],
            TMachine['__TResolvedTypesMeta']
          >,
        observerOrListener?:
          | Observer<StateFrom<TMachine>>
          | ((value: StateFrom<TMachine>) => void)
      ];

export function useInterpret<TMachine extends AnyActorBehavior>(
  behavior: TMachine,
  options?: InterpreterOptions<TMachine>,
  observerOrListener?:
    | Observer<SnapshotFrom<TMachine>>
    | ((value: SnapshotFrom<TMachine>) => void)
): ActorRefFrom<TMachine> {
  const service = useIdleInterpreter(behavior, options as any);

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
