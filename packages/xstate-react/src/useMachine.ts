import { useState, useEffect, useRef } from 'react';
import useIsomorphicLayoutEffect from 'use-isomorphic-layout-effect';
import {
  EventObject,
  StateMachine,
  State,
  Interpreter,
  InterpreterOptions,
  MachineOptions,
  StateConfig,
  Typestate,
  ActionFunction
} from 'xstate';
import {
  MaybeLazy,
  ReactActionFunction,
  ReactActionObject,
  ReactEffectType
} from './types';
import { useInterpret } from './useInterpret';
import { partition } from './utils';

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

export type ActionStateTuple<TContext, TEvent extends EventObject> = [
  ReactActionObject<TContext, TEvent>,
  State<TContext, TEvent, any, any>
];

function executeEffect<TContext, TEvent extends EventObject>(
  action: ReactActionObject<TContext, TEvent>,
  state: State<TContext, TEvent, any, any>
): void {
  const { exec } = action;
  const originalExec = exec!(state.context, state._event.data, {
    action,
    state,
    _event: state._event
  });

  originalExec();
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
  const service = useInterpret(getMachine, options);

  useEffect(() => {
    service.subscribe((s) => {
      // Only change the current state if:
      // - the incoming state is the "live" initial state (since it might have new actors)
      // - OR the incoming state actually changed.
      //
      // The "live" initial state will have .changed === undefined.
      const initialStateChanged =
        s.changed === undefined && Object.keys(s.children).length;

      if (s.changed || initialStateChanged) {
        setState(s);
      }
    });
  }, [service]);

  const [state, setState] = useState(() => {
    const { initialState } = service.machine;
    return (options.state
      ? State.create(options.state)
      : initialState) as State<TContext, TEvent, any, TTypestate>;
  });

  const effectActionsRef = useRef<
    Array<
      [
        ReactActionObject<TContext, TEvent>,
        State<TContext, TEvent, any, TTypestate>
      ]
    >
  >([]);
  const layoutEffectActionsRef = useRef<
    Array<
      [
        ReactActionObject<TContext, TEvent>,
        State<TContext, TEvent, any, TTypestate>
      ]
    >
  >([]);

  useIsomorphicLayoutEffect(() => {
    const sub = service.subscribe((currentState) => {
      if (currentState.actions.length) {
        const reactEffectActions = currentState.actions.filter(
          (action): action is ReactActionObject<TContext, TEvent> => {
            return (
              typeof action.exec === 'function' &&
              '__effect' in (action as ReactActionObject<TContext, TEvent>).exec
            );
          }
        );

        const [effectActions, layoutEffectActions] = partition(
          reactEffectActions,
          (action): action is ReactActionObject<TContext, TEvent> => {
            return action.exec.__effect === ReactEffectType.Effect;
          }
        );

        effectActionsRef.current.push(
          ...effectActions.map<ActionStateTuple<TContext, TEvent>>(
            (effectAction) => [effectAction, currentState]
          )
        );

        layoutEffectActionsRef.current.push(
          ...layoutEffectActions.map<ActionStateTuple<TContext, TEvent>>(
            (layoutEffectAction) => [layoutEffectAction, currentState]
          )
        );
      }
    });

    return () => {
      sub.unsubscribe();
    };
  }, []);

  // this is somewhat weird - this should always be flushed within useLayoutEffect
  // but we don't want to receive warnings about useLayoutEffect being used on the server
  // so we have to use `useIsomorphicLayoutEffect` to silence those warnings
  useIsomorphicLayoutEffect(() => {
    while (layoutEffectActionsRef.current.length) {
      const [
        layoutEffectAction,
        effectState
      ] = layoutEffectActionsRef.current.shift()!;

      executeEffect(layoutEffectAction, effectState);
    }
  }, [state]); // https://github.com/davidkpiano/xstate/pull/1202#discussion_r429677773

  useEffect(() => {
    while (effectActionsRef.current.length) {
      const [effectAction, effectState] = effectActionsRef.current.shift()!;

      executeEffect(effectAction, effectState);
    }
  }, [state]);

  return [state, service.send, service];
}
