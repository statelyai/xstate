import { useCallback, useState } from 'react';
import {
  ActionFunction,
  DefaultTypegenMeta,
  EventObject,
  Interpreter,
  InterpreterOptions,
  MaybeRequiredTypegenMachineOptions,
  OptionsAreRequired,
  State,
  StateConfig,
  StateMachine,
  TypegenMeta,
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
  TMeta extends TypegenMeta = DefaultTypegenMeta
>(
  ...[getMachine, options = {}]: TMeta extends OptionsAreRequired
    ? [
        getMachine: MaybeLazy<
          StateMachine<TContext, any, TEvent, TTypestate, any, TMeta>
        >,
        options: Partial<InterpreterOptions> &
          Partial<UseMachineOptions<TContext, TEvent>> &
          MaybeRequiredTypegenMachineOptions<TContext, TEvent, TMeta>
      ]
    : [
        getMachine: MaybeLazy<
          StateMachine<TContext, any, TEvent, TTypestate, any, TMeta>
        >,
        options?: Partial<InterpreterOptions> &
          Partial<UseMachineOptions<TContext, TEvent>> &
          MaybeRequiredTypegenMachineOptions<TContext, TEvent, TMeta>
      ]
): [
  State<TContext, TEvent, any, TTypestate, TMeta>,
  Interpreter<TContext, any, TEvent, TTypestate, TMeta>['send'],
  Interpreter<TContext, any, TEvent, TTypestate, TMeta>
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

  const service = useInterpret(getMachine, options, listener);

  const [state, setState] = useState(() => {
    const { initialState } = service.machine;
    return (options.state
      ? State.create(options.state)
      : initialState) as State<TContext, TEvent, any, TTypestate>;
  });

  return [state, service.send, service];
}
