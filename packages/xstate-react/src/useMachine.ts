import { useCallback, useEffect } from 'react';
import {
  EventObject,
  StateMachine,
  State,
  Interpreter,
  InterpreterOptions,
  MachineOptions,
  StateConfig,
  Typestate,
  InterpreterStatus
} from 'xstate';
import { MaybeLazy } from './types';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector';
import { useIdleInterpreter } from './useInterpret';

function identity<T>(a: T): T {
  return a;
}

export interface UseMachineOptions<TContext, TEvent extends EventObject> {
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

export function useMachine<
  TContext,
  TEvent extends EventObject,
  TTypestate extends Typestate<TContext> = { value: any; context: TContext }
>(
  getMachine: MaybeLazy<StateMachine<TContext, any, TEvent, TTypestate>>,
  options: Partial<InterpreterOptions> &
    Partial<UseMachineOptions<TContext, TEvent>> &
    Partial<MachineOptions<TContext, TEvent>> = {}
): [
  State<TContext, TEvent, any, TTypestate>,
  Interpreter<TContext, any, TEvent, TTypestate>['send'],
  Interpreter<TContext, any, TEvent, TTypestate>
] {
  const service = useIdleInterpreter(getMachine, options);

  const getSnapshot = useCallback(() => {
    if (service.status === InterpreterStatus.NotStarted) {
      return (options.state
        ? State.create(options.state)
        : service.machine.initialState) as State<
        TContext,
        TEvent,
        any,
        TTypestate
      >;
    }

    return service.state;
  }, [service]);

  const isEqual = useCallback(
    (_prevState, nextState) => {
      if (service.status === InterpreterStatus.NotStarted) {
        return true;
      }

      // Only change the current state if:
      // - the incoming state is the "live" initial state (since it might have new actors)
      // - OR the incoming state actually changed.
      //
      // The "live" initial state will have .changed === undefined.
      const initialStateChanged =
        nextState.changed === undefined &&
        Object.keys(nextState.children).length;

      return !(nextState.changed || initialStateChanged);
    },
    [service]
  );

  const subscribe = useCallback(
    (handleStoreChange) => {
      const { unsubscribe } = service.subscribe(handleStoreChange);
      return unsubscribe;
    },
    [getSnapshot]
  );
  const storeSnapshot = useSyncExternalStoreWithSelector(
    subscribe,
    getSnapshot,
    undefined,
    identity,
    isEqual
  );

  useEffect(() => {
    const rehydratedState = options.state;
    service.start(
      rehydratedState ? (State.create(rehydratedState) as any) : undefined
    );

    return () => {
      service.stop();
    };
  }, []);

  return [storeSnapshot, service.send, service];
}
