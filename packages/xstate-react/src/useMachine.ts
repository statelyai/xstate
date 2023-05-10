import { useCallback, useEffect } from 'react';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector';
import {
  AnyState,
  AnyStateMachine,
  AreAllImplementationsAssumedToBeProvided,
  InterpreterFrom,
  InterpreterOptions,
  InterpreterStatus,
  MissingImplementationsError,
  StateFrom
} from 'xstate';
import { Prop } from './types.ts';
import { useIdleInterpreter } from './useInterpret.ts';

function identity<T>(a: T): T {
  return a;
}

const isEqual = (prevState: AnyState, nextState: AnyState) => {
  return prevState === nextState || nextState.changed === false;
};

type UseMachineReturn<
  TMachine extends AnyStateMachine,
  TInterpreter = InterpreterFrom<TMachine>
> = [StateFrom<TMachine>, Prop<TInterpreter, 'send'>, TInterpreter];

export function useMachine<TMachine extends AnyStateMachine>(
  machine: AreAllImplementationsAssumedToBeProvided<
    TMachine['__TResolvedTypesMeta']
  > extends true
    ? TMachine
    : MissingImplementationsError<TMachine['__TResolvedTypesMeta']>,
  options: InterpreterOptions<TMachine> = {}
): UseMachineReturn<TMachine> {
  // using `useIdleInterpreter` allows us to subscribe to the service *before* we start it
  // so we don't miss any notifications
  const service = useIdleInterpreter(machine as any, options as any);

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
      (service as any)._initState();
    };
  }, []);

  return [storeSnapshot, service.send, service] as any;
}
