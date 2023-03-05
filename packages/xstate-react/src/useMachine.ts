import { useCallback, useEffect } from 'react';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector';
import {
  AnyState,
  AnyStateMachine,
  AreAllImplementationsAssumedToBeProvided,
  InternalMachineImplementations,
  InterpreterFrom,
  InterpreterOptions,
  InterpreterStatus,
  StateFrom
} from 'xstate';
import { MaybeLazy, Prop } from './types.js';
import { useIdleInterpreter } from './useInterpret.js';

function identity<T>(a: T): T {
  return a;
}

const isEqual = (prevState: AnyState, nextState: AnyState) => {
  return prevState === nextState || nextState.changed === false;
};

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
          >
      ]
    : [
        options?: InterpreterOptions<TMachine> &
          InternalMachineImplementations<
            TMachine['__TContext'],
            TMachine['__TEvent'],
            TMachine['__TResolvedTypesMeta']
          >
      ];

type UseMachineReturn<
  TMachine extends AnyStateMachine,
  TInterpreter = InterpreterFrom<TMachine>
> = [StateFrom<TMachine>, Prop<TInterpreter, 'send'>, TInterpreter];

export function useMachine<TMachine extends AnyStateMachine>(
  getMachine: MaybeLazy<TMachine>,
  ...[options = {}]: RestParams<TMachine>
): UseMachineReturn<TMachine> {
  // using `useIdleInterpreter` allows us to subscribe to the service *before* we start it
  // so we don't miss any notifications
  const service = useIdleInterpreter(getMachine, options as any);

  const getSnapshot = useCallback(() => {
    return service.getSnapshot();
  }, [service]);

  const subscribe = useCallback(
    (handleStoreChange) => {
      const { unsubscribe } = service.subscribe(handleStoreChange);
      return unsubscribe;
    },
    [service]
  );
  const storeSnapshot = useSyncExternalStoreWithSelector(
    subscribe,
    getSnapshot,
    getSnapshot,
    identity,
    isEqual
  );

  useEffect(() => {
    service.start();

    return () => {
      service.stop();
      service.status = InterpreterStatus.NotStarted;
    };
  }, []);

  return [storeSnapshot, service.send, service] as any;
}
