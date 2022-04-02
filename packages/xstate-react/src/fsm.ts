import {
  createMachine,
  EventObject,
  interpret,
  StateMachine,
  Typestate,
  AnyMachine,
  MachineImplementationsFrom,
  StateFrom,
  ServiceFrom,
  AnyService,
  InterpreterStatus
} from '@xstate/fsm';
import { useCallback, useEffect, useState } from 'react';
import useIsomorphicLayoutEffect from 'use-isomorphic-layout-effect';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector';
import useConstant from './useConstant';

function identity<T>(a: T): T {
  return a;
}

const getServiceState = <
  TContext extends object,
  TEvent extends EventObject = EventObject,
  TState extends Typestate<TContext> = { value: any; context: TContext }
>(
  service: StateMachine.Service<TContext, TEvent, TState>
): StateMachine.State<TContext, TEvent, TState> => {
  let currentValue: StateMachine.State<TContext, TEvent, TState>;
  service
    .subscribe((state) => {
      currentValue = state;
    })
    .unsubscribe();
  return currentValue!;
};

export function useMachine<TMachine extends AnyMachine>(
  stateMachine: TMachine,
  options?: MachineImplementationsFrom<TMachine>
): [StateFrom<TMachine>, ServiceFrom<TMachine>['send'], ServiceFrom<TMachine>] {
  if (process.env.NODE_ENV !== 'production') {
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
    };
    return [service, queue];
  });

  useIsomorphicLayoutEffect(() => {
    if (options) {
      (service as any)._machine._options = options;
    }
  });

  const useServiceResult = useService(service);

  useEffect(() => {
    service.start();
    queue.forEach(service.send);

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

export function useService<TService extends AnyService>(
  service: TService
): [StateFrom<TService>, TService['send'], TService] {
  const getSnapshot = useCallback(() => getServiceState(service), [service]);

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
