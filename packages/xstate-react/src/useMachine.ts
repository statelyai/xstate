import { useCallback, useState } from 'react';
import {
  ActionFunction,
  AnyStateMachine,
  AreAllImplementationsAssumedToBeProvided,
  EventObject,
  InternalMachineImplementations,
  InterpreterFrom,
  InterpreterOptions,
  MachineContext,
  State,
  StateConfig,
  StateFrom
} from 'xstate';
import {
  MaybeLazy,
  Prop,
  ReactActionFunction,
  ReactActionObject,
  ReactEffectType
} from './types';
import { useInterpret } from './useInterpret';

function createReactAction<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  exec: ActionFunction<TContext, TEvent> | undefined,
  tag: ReactEffectType
): ReactActionObject<TContext, TEvent> {
  const reactExec: ReactActionFunction<TContext, TEvent> = (...args) => {
    // don't execute; just return
    return () => {
      return exec?.(...args);
    };
  };
  return {
    type: 'xstate/react.action',
    params: { __effect: tag, exec: reactExec }
  };
}

export function asEffect<
  TContext extends MachineContext,
  TEvent extends EventObject
>(exec: ActionFunction<TContext, TEvent>): ReactActionObject<TContext, TEvent> {
  return createReactAction(exec, ReactEffectType.Effect);
}

export function asLayoutEffect<
  TContext extends MachineContext,
  TEvent extends EventObject
>(exec: ActionFunction<TContext, TEvent>): ReactActionObject<TContext, TEvent> {
  return createReactAction(exec, ReactEffectType.LayoutEffect);
}

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

export function useMachine<TMachine extends AnyStateMachine>(
  getMachine: MaybeLazy<TMachine>,
  ...[options = {}]: RestParams<TMachine>
): UseMachineReturn<TMachine> {
  const listener = useCallback((nextState: StateFrom<TMachine>) => {
    // Only change the current state if:
    // - the incoming state is the "live" initial state (since it might have new actors)
    // - OR the incoming state actually changed.
    //
    // The "live" initial state will have .changed === undefined.
    const initialStateChanged =
      nextState.changed === undefined && Object.keys(nextState.children).length;

    if (nextState.changed || initialStateChanged) {
      setState(nextState);
    }
  }, []);

  const service = useInterpret(getMachine as any, options as any, listener);

  const [state, setState] = useState(() => {
    const { initialState } = service.machine;
    return (options.state
      ? State.create(options.state as any)
      : initialState) as StateFrom<TMachine>;
  });

  return [state, service.send, service] as any;
}
