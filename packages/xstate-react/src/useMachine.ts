import { useCallback, useState } from 'react';
import {
  ActionFunction,
  AreAllImplementationsAssumedToBeProvided,
  EventObject,
  InternalMachineOptions,
  InterpreterFrom,
  InterpreterOptions,
  State,
  StateConfig,
  StateFrom,
  StateMachine
} from 'xstate';
import { MaybeLazy, Prop, ReactActionFunction, ReactEffectType } from './types';
import { useInterpret } from './useInterpret';

function createReactActionFunction<TContext, TEvent extends EventObject>(
  exec: ActionFunction<TContext, TEvent>,
  tag: ReactEffectType
): ReactActionFunction<TContext, TEvent> {
  const effectExec: unknown = (...args: Parameters<typeof exec>) => {
    // don't execute; just return
    return () => {
      return exec(...args);
    };
  };

  Object.defineProperties(effectExec, {
    name: { value: `effect:${exec.name}` },
    __effect: { value: tag }
  });

  return effectExec as ReactActionFunction<TContext, TEvent>;
}

export function asEffect<TContext, TEvent extends EventObject>(
  exec: ActionFunction<TContext, TEvent>
): ReactActionFunction<TContext, TEvent> {
  return createReactActionFunction(exec, ReactEffectType.Effect);
}

export function asLayoutEffect<TContext, TEvent extends EventObject>(
  exec: ActionFunction<TContext, TEvent>
): ReactActionFunction<TContext, TEvent> {
  return createReactActionFunction(exec, ReactEffectType.LayoutEffect);
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

type RestParams<
  TMachine extends StateMachine<any, any, any, any, any>
> = AreAllImplementationsAssumedToBeProvided<
  TMachine['__TResolvedTypes']
> extends false
  ? [
      options: InterpreterOptions &
        UseMachineOptions<
          TMachine['__TResolvedTypes']['TContext'],
          TMachine['__TResolvedTypes']['TEvent']
        > &
        InternalMachineOptions<TMachine['__TResolvedTypes'], true>
    ]
  : [
      options?: InterpreterOptions &
        UseMachineOptions<
          TMachine['__TResolvedTypes']['TContext'],
          TMachine['__TResolvedTypes']['TEvent']
        > &
        InternalMachineOptions<TMachine['__TResolvedTypes']>
    ];

type UseMachineReturn<
  TMachine extends StateMachine<any, any, any, any, any>,
  TInterpreter = InterpreterFrom<TMachine>
> = [StateFrom<TMachine>, Prop<TInterpreter, 'send'>, TInterpreter];

export function useMachine<
  TMachine extends StateMachine<any, any, any, any, any>
>(
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
