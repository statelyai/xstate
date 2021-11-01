import { useCallback, useState } from 'react';
import {
  EventObject,
  StateMachine,
  State,
  Interpreter,
  InterpreterOptions,
  MachineOptions,
  StateConfig,
  Typestate,
  ActionFunction,
  ExtraGenerics
} from 'xstate';
import { MaybeLazy, ReactActionFunction, ReactEffectType } from './types';
import { useInterpret } from './useInterpret';

function createReactActionFunction<
  TContext,
  TEvent extends EventObject,
  TExtra extends ExtraGenerics = {}
>(
  exec: ActionFunction<TContext, TEvent, TExtra>,
  tag: ReactEffectType
): ReactActionFunction<TContext, TEvent, TExtra> {
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

  return effectExec as ReactActionFunction<TContext, TEvent, TExtra>;
}

export function asEffect<
  TContext,
  TEvent extends EventObject,
  TExtra extends ExtraGenerics = {}
>(
  exec: ActionFunction<TContext, TEvent, TExtra>
): ReactActionFunction<TContext, TEvent, TExtra> {
  return createReactActionFunction(exec, ReactEffectType.Effect);
}

export function asLayoutEffect<TContext, TEvent extends EventObject>(
  exec: ActionFunction<TContext, TEvent>
): ReactActionFunction<TContext, TEvent> {
  return createReactActionFunction(exec, ReactEffectType.LayoutEffect);
}

export interface UseMachineOptions<
  TContext,
  TEvent extends EventObject,
  TExtra extends ExtraGenerics = {}
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
  input?: TExtra['input'];
}

export function useMachine<
  TContext,
  TEvent extends EventObject,
  TTypestate extends Typestate<TContext> = { value: any; context: TContext },
  TExtra extends ExtraGenerics = {}
>(
  getMachine: MaybeLazy<
    StateMachine<TContext, any, TEvent, TTypestate, TExtra>
  >,
  options: Partial<InterpreterOptions> &
    Partial<UseMachineOptions<TContext, TEvent, TExtra>> &
    Partial<MachineOptions<TContext, TEvent, TExtra>> = {}
): [
  State<TContext, TEvent, any, TTypestate, TExtra>,
  Interpreter<TContext, any, TEvent, TTypestate, TExtra>['send'],
  Interpreter<TContext, any, TEvent, TTypestate, TExtra>
] {
  const listener = useCallback(
    (nextState: State<TContext, TEvent, any, TTypestate, TExtra>) => {
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
      : initialState) as State<TContext, TEvent, any, TTypestate, TExtra>;
  });

  return [state, service.send, service];
}
