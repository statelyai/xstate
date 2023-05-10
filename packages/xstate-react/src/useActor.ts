import { useCallback, useEffect, useState } from 'react';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector';
import {
  ActorRefFrom,
  AnyActorBehavior,
  AnyState,
  AnyStateMachine,
  AreAllImplementationsAssumedToBeProvided,
  EventFromBehavior,
  InternalMachineImplementations,
  InterpreterOptions,
  InterpreterStatus,
  SnapshotFrom
} from 'xstate';
import { useIdleInterpreter } from './useActorRef.ts';

function identity<T>(a: T): T {
  return a;
}

const isEqual = (prevState: AnyState, nextState: AnyState) => {
  return prevState === nextState || nextState.changed === false;
};

type RestParams<TMachine extends AnyActorBehavior> =
  TMachine extends AnyStateMachine
    ? AreAllImplementationsAssumedToBeProvided<
        TMachine['__TResolvedTypesMeta']
      > extends false
      ? [
          options: InterpreterOptions<TMachine> &
            InternalMachineImplementations<
              TMachine['__TContext'],
              TMachine['__TEvent'],
              TMachine['__TResolvedTypesMeta'],
              true
            >
        ]
      : [
          options?: InterpreterOptions<TMachine> &
            InternalMachineImplementations<
              TMachine['__TContext'],
              TMachine['__TEvent'],
              TMachine['__TResolvedTypesMeta']
            >
        ]
    : any;

export function useActor<TBehavior extends AnyActorBehavior>(
  behavior: TBehavior,
  options: InterpreterOptions<TBehavior> = {}
): [
  SnapshotFrom<TBehavior>,
  (event: EventFromBehavior<TBehavior>) => void,
  ActorRefFrom<TBehavior>
] {
  const actorRef = useIdleInterpreter(behavior, options as any);

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

  if (typeof behavior !== 'function') {
    actorRef.behavior.options = (behavior as any).options;
  }

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
