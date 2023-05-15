import isDevelopment from '#is-development';
import {
  createMachine,
  interpret,
  InterpreterStatus,
  MachineImplementationsFrom,
  ServiceFrom,
  StateFrom,
  StateMachine
} from '@xstate/fsm';
import { useCallback, useEffect, useRef, useState } from 'react';
import useIsomorphicLayoutEffect from 'use-isomorphic-layout-effect';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector';
import useConstant from './useConstant.ts';

function identity<T>(a: T): T {
  return a;
}

export function useMachine<TMachine extends StateMachine.AnyMachine>(
  stateMachine: TMachine,
  options?: MachineImplementationsFrom<TMachine>
): [StateFrom<TMachine>, ServiceFrom<TMachine>['send'], ServiceFrom<TMachine>] {
  const persistedStateRef = useRef<StateMachine.AnyState>();

  if (isDevelopment) {
    const [initialMachine] = useState(stateMachine);

    if (stateMachine !== initialMachine) {
      console.warn(
        'Machine given to `useMachine` has changed between renders. This is not supported and might lead to unexpected results.\n' +
          'Please make sure that you pass the same Machine as argument each time.'
      );
    }
  }

  const [service, queue] = useConstant(() => {
    const queue: unknown[] = [];
    const service = interpret(
      createMachine(
        stateMachine.config,
        options ? options : (stateMachine as any)._options
      )
    );
    const { send } = service;
    service.send = (event) => {
      if (service.status === InterpreterStatus.NotStarted) {
        queue.push(event);
        return;
      }
      send(event);
      persistedStateRef.current = service.state;
    };
    return [service, queue];
  });

  // TODO: consider using `useInsertionEffect` if available
  useIsomorphicLayoutEffect(() => {
    if (options) {
      (service as any)._machine._options = options;
    }
  });

  const useServiceResult = useService(service);

  useEffect(() => {
    service.start(persistedStateRef.current);
    queue.forEach(service.send);

    persistedStateRef.current = service.state;

    return () => {
      service.stop();
    };
  }, []);

  return useServiceResult as any;
}

const isEqual = (
  _prevState: StateMachine.AnyState,
  nextState: StateMachine.AnyState
) => nextState.changed === false;

export function useService<TService extends StateMachine.AnyService>(
  service: TService
): [StateFrom<TService>, TService['send'], TService] {
  const getSnapshot = useCallback(() => service.state, [service]);

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

  return [storeSnapshot, service.send, service] as any;
}
