import { useCallback, useState } from 'react';
import {
  ActionFunction,
  AreAllImplementationsAssumedToBeProvided,
  EventObject,
  StateMachine,
  State,
  InterpreterOptions,
  MachineImplementations,
  StateConfig,
  ActionFunction,
  InterpreterOf,
  MachineContext
} from 'xstate';
import {
  MaybeLazy,
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
  TMachine extends StateMachine<any, any, any, any, any, any, any>
> = AreAllImplementationsAssumedToBeProvided<
  TMachine['__TResolvedTypesMeta']
> extends false
  ? [
      options: InterpreterOptions &
        UseMachineOptions<TMachine['__TContext'], TMachine['__TEvent']> &
        InternalMachineOptions<
          TMachine['__TContext'],
          TMachine['__TEvent'],
          TMachine['__TResolvedTypesMeta'],
          true
        >
    ]
  : [
      options?: InterpreterOptions &
        UseMachineOptions<TMachine['__TContext'], TMachine['__TEvent']> &
        InternalMachineOptions<
          TMachine['__TContext'],
          TMachine['__TEvent'],
          TMachine['__TResolvedTypesMeta']
        >
    ];

type UseMachineReturn<
  TMachine extends StateMachine<any, any, any, any, any, any, any>,
  TInterpreter = InterpreterFrom<TMachine>
> = [StateFrom<TMachine>, Prop<TInterpreter, 'send'>, TInterpreter];

export function useMachine<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  getMachine: MaybeLazy<StateMachine<TContext, TEvent>>,
  options: Partial<InterpreterOptions> &
    Partial<UseMachineOptions<TContext, TEvent>> &
    Partial<MachineImplementations<TContext, TEvent>> = {}
): [
  State<TContext, TEvent>,
  InterpreterOf<StateMachine<TContext, TEvent>>['send'],
  InterpreterOf<StateMachine<TContext, TEvent>>
] {
  const listener = useCallback((nextState: State<TContext, TEvent>) => {
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
      ? State.create(options.state)
      : initialState) as State<TContext, TEvent>;
  });

  return [state, service.send, service] as any;
}
