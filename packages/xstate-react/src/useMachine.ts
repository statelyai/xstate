import { useCallback, useEffect, useRef } from 'react';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector';
import {
  AnyState,
  AnyStateMachine,
  AreAllImplementationsAssumedToBeProvided,
  EventObject,
  InternalMachineImplementations,
  InterpreterFrom,
  InterpreterOptions,
  InterpreterStatus,
  MachineContext,
  State,
  StateConfig,
  StateFrom
} from 'xstate';
import { MaybeLazy, Prop } from './types';
import { useIdleInterpreter } from './useInterpret';

function identity<T>(a: T): T {
  return a;
}

const isEqual = (prevState: AnyState, nextState: AnyState) => {
  return prevState === nextState || nextState.changed === false;
};

export interface UseMachineOptions<
  TContext extends MachineContext,
  TEvent extends EventObject
> {
  /**
   * If provided, will be merged with machine's `context`.
   */
  context?: Partial<TContext>;
  /**
   * The state to rehydrate the machine to. The machine will
   * start at this state instead of its `initialState`.
   */
  state?: StateConfig<TContext, TEvent>;
}

type RestParams<
  TMachine extends AnyStateMachine
> = AreAllImplementationsAssumedToBeProvided<
  TMachine['__TResolvedTypesMeta']
> extends false
  ? [
      options: InterpreterOptions &
        UseMachineOptions<TMachine['__TContext'], TMachine['__TEvent']> &
        InternalMachineImplementations<
          TMachine['__TContext'],
          TMachine['__TEvent'],
          TMachine['__TResolvedTypesMeta'],
          true
        >
    ]
  : [
      options?: InterpreterOptions &
        UseMachineOptions<TMachine['__TContext'], TMachine['__TEvent']> &
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

// TODO: rethink how we can do this better
const cachedRehydratedStates = new WeakMap();

export function useMachine<TMachine extends AnyStateMachine>(
  getMachine: MaybeLazy<TMachine>,
  ...[options = {}]: RestParams<TMachine>
): UseMachineReturn<TMachine> {
  // using `useIdleInterpreter` allows us to subscribe to the service *before* we start it
  // so we don't miss any notifications
  const service = useIdleInterpreter(getMachine, options as any);

  const getSnapshot = useCallback(() => {
    if (service.status === InterpreterStatus.NotStarted && options.state) {
      const cached = cachedRehydratedStates.get(options.state);
      if (cached) {
        return cached;
      }
      const created = (service.behavior as AnyStateMachine).createState(
        options.state
      ) as State<any, any, any>;
      cachedRehydratedStates.set(options.state, created);
      return created;
    }

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
    const rehydratedState = options.state;
    service.start(
      rehydratedState
        ? ((service.behavior as AnyStateMachine).createState(
            rehydratedState
          ) as any)
        : undefined
    );

    return () => {
      service.stop();
      service.status = InterpreterStatus.NotStarted;
    };
  }, []);

  return [storeSnapshot, service.send, service] as any;
}
