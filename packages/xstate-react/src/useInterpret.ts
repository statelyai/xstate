import { useEffect, useState } from 'react';
import {
  AnyInterpreter,
  interpret,
  ActorRefFrom,
  SnapshotFrom,
  InterpreterOptions,
  InterpreterStatus,
  Observer,
  toObserver,
  AnyActorBehavior,
  ValidateActorBehavior
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

export function useInterpret<TBehavior extends AnyActorBehavior>(
  behavior: TBehavior & ValidateActorBehavior<TBehavior>,
  options?: InterpreterOptions<TBehavior>,
  observerOrListener?:
    | Observer<SnapshotFrom<TBehavior>>
    | ((value: SnapshotFrom<TBehavior>) => void)
): ActorRefFrom<TBehavior> {
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
