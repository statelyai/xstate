import {
  createMachine,
  EventObject,
  interpret,
  StateMachine,
  Typestate
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

export function useMachine<
  TContext extends object,
  TEvent extends EventObject = EventObject,
  TState extends Typestate<TContext> = { value: any; context: TContext }
>(
  stateMachine: StateMachine.Machine<TContext, TEvent, TState>,
  options?: {
    actions?: StateMachine.ActionMap<TContext, TEvent>;
  }
): [
  StateMachine.State<TContext, TEvent, TState>,
  StateMachine.Service<TContext, TEvent, TState>['send'],
  StateMachine.Service<TContext, TEvent, TState>
] {
  if (process.env.NODE_ENV !== 'production') {
    const [initialMachine] = useState(stateMachine);

    if (stateMachine !== initialMachine) {
      console.warn(
        'Machine given to `useMachine` has changed between renders. This is not supported and might lead to unexpected results.\n' +
          'Please make sure that you pass the same Machine as argument each time.'
      );
    }
  }

  const service = useConstant(() =>
    interpret(
      createMachine(
        stateMachine.config,
        options ? options : (stateMachine as any)._options
      )
    )
  );

  const [state, setState] = useState(() => getServiceState(service));

  useIsomorphicLayoutEffect(() => {
    if (options) {
      (service as any)._machine._options = options;
    }
  });

  useEffect(() => {
    service.subscribe(setState);
    service.start();

    return () => {
      service.stop();
    };
  }, []);

  return [state, service.send, service];
}

export function useService<
  TContext extends object,
  TEvent extends EventObject = EventObject,
  TState extends Typestate<TContext> = { value: any; context: TContext }
>(
  service: StateMachine.Service<TContext, TEvent, TState>
): [
  StateMachine.State<TContext, TEvent, TState>,
  StateMachine.Service<TContext, TEvent, TState>['send'],
  StateMachine.Service<TContext, TEvent, TState>
] {
  const getSnapshot = useCallback(() => getServiceState(service), [service]);

  const isEqual = useCallback(
    (_prevState, nextState) => nextState.changed === false,
    []
  );

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

  return [storeSnapshot, service.send, service];
}
