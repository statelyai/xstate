import { useCallback, useEffect, useState } from 'react';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector';
import {
  ActorRefFrom,
  AnyActorBehavior,
  AnyState,
  EventFrom,
  InterpreterOptions,
  InterpreterStatus,
  SnapshotFrom,
  ValidateActorBehavior,
  interpret
} from 'xstate';
import useConstant from './useConstant.ts';
import useIsomorphicLayoutEffect from 'use-isomorphic-layout-effect';

function identity<T>(a: T): T {
  return a;
}

const isEqual = (prevState: AnyState, nextState: AnyState) => {
  return prevState === nextState || nextState.changed === false;
};

// type UseMachineReturn<
//   TMachine extends AnyStateMachine,
//   TInterpreter = InterpreterFrom<TMachine>
// > = [StateFrom<TMachine>, Prop<TInterpreter, 'send'>, TInterpreter];

// export function useMachine<TMachine extends AnyStateMachine>(
//   machine: AreAllImplementationsAssumedToBeProvided<
//     TMachine['__TResolvedTypesMeta']
//   > extends true
//     ? TMachine
//     : MissingImplementationsError<TMachine['__TResolvedTypesMeta']>,
//   options: InterpreterOptions<TMachine> = {}
// ): UseMachineReturn<TMachine> {
//   // using `useIdleInterpreter` allows us to subscribe to the service *before* we start it
//   // so we don't miss any notifications
//   const service = useIdleInterpreter(machine as any, options as any);

//   const getSnapshot = useCallback(() => {
//     return service.getSnapshot();
//   }, [service]);

//   const subscribe = useCallback(
//     (handleStoreChange) => {
//       const { unsubscribe } = service.subscribe(handleStoreChange);
//       return unsubscribe;
//     },
//     [service]
//   );
//   const storeSnapshot = useSyncExternalStoreWithSelector(
//     subscribe,
//     getSnapshot,
//     getSnapshot,
//     identity,
//     isEqual
//   );

//   useEffect(() => {
//     service.start();

//     return () => {
//       service.stop();
//       service.status = InterpreterStatus.NotStarted;
//       (service as any)._initState();
//     };
//   }, []);

//   return [storeSnapshot, service.send, service] as any;
// }

export function useMachine2<TBehavior extends AnyActorBehavior>(
  behavior: TBehavior & ValidateActorBehavior<TBehavior>,
  options?: InterpreterOptions<TBehavior>
): [
  SnapshotFrom<TBehavior>,
  (event: EventFrom<TBehavior>) => void,
  ActorRefFrom<TBehavior>
] {
  const actorRef = useConstant(() => interpret(behavior, options));

  const getSnapshot = useCallback(() => {
    return actorRef.getSnapshot();
  }, [actorRef]);

  const subscribe = useCallback(
    (handleStoreChange) => {
      const { unsubscribe } = actorRef.subscribe(handleStoreChange);
      return unsubscribe;
    },
    [actorRef]
  );

  const actorSnapshot = useSyncExternalStoreWithSelector(
    subscribe,
    getSnapshot,
    getSnapshot,
    identity,
    isEqual
  );

  useEffect(() => {
    actorRef.start();

    return () => {
      actorRef.stop();
      actorRef.status = InterpreterStatus.NotStarted;
      (actorRef as any)._initState();
    };
  }, [actorRef]);

  // TODO: consider using `useAsapEffect` that would do this in `useInsertionEffect` is that's available
  useIsomorphicLayoutEffect(() => {
    actorRef.behavior.options = behavior.options;
  });

  if (process.env.NODE_ENV !== 'production' && typeof behavior !== 'function') {
    const [initialMachine] = useState(behavior);

    if (
      (behavior.config ?? behavior) !==
      (initialMachine.config ?? initialMachine)
    ) {
      console.warn(
        'Machine given to `useMachine` has changed between renders. This is not supported and might lead to unexpected results.\n' +
          'Please make sure that you pass the same Machine as argument each time.'
      );
    }
  }

  return [actorSnapshot, actorRef.send, actorRef] as any;
}
