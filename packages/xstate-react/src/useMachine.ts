import { useCallback, useState } from 'react';
import {
  ActionFunction,
  AreAllImplementationsAssumedToBeProvided,
  BaseActionObject,
  EventObject,
  Interpreter,
  InterpreterOptions,
  MaybeTypegenMachineOptions,
  State,
  StateConfig,
  StateMachine,
  TypegenConstraint,
  TypegenDisabled,
  Typestate
} from 'xstate';
import { MaybeLazy, ReactActionFunction, ReactEffectType } from './types';
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

export function useMachine<
  TContext,
  TEvent extends EventObject,
  TTypestate extends Typestate<TContext> = { value: any; context: TContext },
  TResolvedTypesMeta extends TypegenConstraint = TypegenDisabled
>(
  ...[
    getMachine,
    options = {}
  ]: AreAllImplementationsAssumedToBeProvided<TResolvedTypesMeta> extends false
    ? [
        getMachine: MaybeLazy<
          StateMachine<
            TContext,
            any,
            TEvent,
            TTypestate,
            any,
            TResolvedTypesMeta
          >
        >,
        options: InterpreterOptions &
          UseMachineOptions<TContext, TEvent> &
          MaybeTypegenMachineOptions<
            TContext,
            TEvent,
            BaseActionObject,
            TResolvedTypesMeta,
            true
          >
      ]
    : [
        getMachine: MaybeLazy<
          StateMachine<
            TContext,
            any,
            TEvent,
            TTypestate,
            any,
            TResolvedTypesMeta
          >
        >,
        options?: InterpreterOptions &
          UseMachineOptions<TContext, TEvent> &
          MaybeTypegenMachineOptions<
            TContext,
            TEvent,
            BaseActionObject,
            TResolvedTypesMeta
          >
      ]
): [
  State<TContext, TEvent, any, TTypestate, TResolvedTypesMeta>,
  Interpreter<TContext, any, TEvent, TTypestate, TResolvedTypesMeta>['send'],
  Interpreter<TContext, any, TEvent, TTypestate, TResolvedTypesMeta>
] {
  const listener = useCallback(
    (nextState: State<TContext, TEvent, any, TTypestate>) => {
      // Only change the current state if:
      // - the incoming state is the "live" initial state (since it might have new actors)
      // - OR the incoming state actually changed.
      //
      // The "live" initial state will have .changed === undefined.
      const initialStateChanged =
        nextState.changed === undefined &&
        Object.keys(nextState.children).length;

      if (nextState.changed || initialStateChanged) {
        setState(nextState);
      }
    },
    []
  );

  const service = useInterpret(getMachine as any, options, listener);

  const [state, setState] = useState(() => {
    const { initialState } = service.machine;
    return (options.state
      ? State.create(options.state)
      : initialState) as State<TContext, TEvent, any, TTypestate>;
  });

  return [state, service.send, service] as any;
}
