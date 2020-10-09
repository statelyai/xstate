import { useState, useEffect, useRef } from 'react';
import useIsomorphicLayoutEffect from 'use-isomorphic-layout-effect';
import {
  interpret,
  EventObject,
  StateMachine,
  State,
  Interpreter,
  InterpreterOptions,
  MachineOptions,
  StateConfig,
  Typestate,
  ActionFunction,
  ActionMeta,
  StateNode
} from 'xstate';
import { MaybeLazy } from './types';
import useConstant from './useConstant';
import { partition } from './utils';

enum ReactEffectType {
  Effect = 1,
  LayoutEffect = 2
}

export interface ReactActionFunction<
  TContext,
  TEvent extends EventObject,
  TAction extends { type: string }
> {
  (
    context: TContext,
    event: TEvent,
    meta: ActionMeta<TContext, TEvent, TAction>
  ): () => void;
  __effect: ReactEffectType;
}

export interface ReactActionObject<
  TContext,
  TEvent extends EventObject,
  TAction extends { type: string }
> {
  type: string;
  exec: ReactActionFunction<TContext, TEvent, TAction>;
}

function createReactActionFunction<
  TContext,
  TEvent extends EventObject,
  TAction extends { type: string }
>(
  exec: ActionFunction<TContext, TEvent, TAction>,
  tag: ReactEffectType
): ReactActionFunction<TContext, TEvent, TAction> {
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

  return effectExec as ReactActionFunction<TContext, TEvent, TAction>;
}

export function asEffect<
  TContext,
  TEvent extends EventObject,
  TAction extends { type: string }
>(
  exec: ActionFunction<TContext, TEvent, TAction>
): ReactActionFunction<TContext, TEvent, TAction> {
  return createReactActionFunction(exec, ReactEffectType.Effect);
}

export function asLayoutEffect<
  TContext,
  TEvent extends EventObject,
  TAction extends { type: string }
>(
  exec: ActionFunction<TContext, TEvent, TAction>
): ReactActionFunction<TContext, TEvent, TAction> {
  return createReactActionFunction(exec, ReactEffectType.LayoutEffect);
}

export type ActionStateTuple<
  TContext,
  TEvent extends EventObject,
  TAction extends { type: string }
> = [
  ReactActionObject<TContext, TEvent, TAction>,
  State<TContext, TEvent, any, any, TAction>
];

function executeEffect<
  TContext,
  TEvent extends EventObject,
  TAction extends { type: string }
>(
  action: ReactActionObject<TContext, TEvent, TAction>,
  state: State<TContext, TEvent>
): void {
  const { exec } = action;
  const originalExec = exec!(state.context, state._event.data, {
    action: action as any,
    state,
    _event: state._event
  });

  originalExec();
}

interface UseMachineOptions<
  TContext,
  TEvent extends EventObject,
  TAction extends { type: string }
> {
  /**
   * If provided, will be merged with machine's `context`.
   */
  context?: Partial<TContext>;
  /**
   * The state to rehydrate the machine to. The machine will
   * start at this state instead of its `initialState`.
   */
  state?: StateConfig<TContext, TEvent, TAction>;
}

export function useMachine<
  TContext,
  TEvent extends EventObject,
  TTypestate extends Typestate<TContext> = {
    value: any;
    context: TContext;
  },
  TAction extends { type: string } = { type: string }
>(
  getMachine: MaybeLazy<
    StateMachine<TContext, any, TEvent, TTypestate, TAction>
  >,
  options: Partial<InterpreterOptions> &
    Partial<UseMachineOptions<TContext, TEvent, TAction>> &
    Partial<MachineOptions<TContext, TEvent, TAction>> = {}
): [
  State<TContext, TEvent, any, TTypestate>,
  Interpreter<TContext, any, TEvent, TTypestate, TAction>['send'],
  Interpreter<TContext, any, TEvent, TTypestate, TAction>
] {
  const machine = useConstant(() => {
    return typeof getMachine === 'function' ? getMachine() : getMachine;
  });

  if (
    process.env.NODE_ENV !== 'production' &&
    typeof getMachine !== 'function'
  ) {
    const [initialMachine] = useState(machine);

    if (machine !== initialMachine) {
      console.warn(
        'Machine given to `useMachine` has changed between renders. This is not supported and might lead to unexpected results.\n' +
          'Please make sure that you pass the same Machine as argument each time.'
      );
    }
  }

  const {
    context,
    guards,
    actions,
    activities,
    services,
    delays,
    state: rehydratedState,
    ...interpreterOptions
  } = options;

  const [resolvedMachine, service] = useConstant<
    [
      StateNode<TContext, any, TEvent, TTypestate, TAction>,
      Interpreter<TContext, any, TEvent, TTypestate, TAction>
    ]
  >(() => {
    const machineConfig = {
      context,
      guards,
      actions,
      activities,
      services,
      delays
    };
    const resolvedMachine = machine.withConfig(machineConfig, {
      ...machine.context,
      ...context
    } as TContext);

    return [
      resolvedMachine,
      interpret(resolvedMachine, {
        deferEvents: true,
        ...interpreterOptions
      })
    ];
  });

  const [state, setState] = useState(() => {
    // Always read the initial state to properly initialize the machine
    // https://github.com/davidkpiano/xstate/issues/1334
    const { initialState } = resolvedMachine;
    return rehydratedState ? State.create(rehydratedState) : initialState;
  });

  const effectActionsRef = useRef<
    Array<
      [ReactActionObject<TContext, TEvent, TAction>, State<TContext, TEvent>]
    >
  >([]);
  const layoutEffectActionsRef = useRef<
    Array<
      [ReactActionObject<TContext, TEvent, TAction>, State<TContext, TEvent>]
    >
  >([]);

  useIsomorphicLayoutEffect(() => {
    service
      .onTransition((currentState) => {
        // Only change the current state if:
        // - the incoming state is the "live" initial state (since it might have new actors)
        // - OR the incoming state actually changed.
        //
        // The "live" initial state will have .changed === undefined.
        const initialStateChanged =
          currentState.changed === undefined &&
          Object.keys(currentState.children).length;

        if (currentState.changed || initialStateChanged) {
          setState(currentState);
        }

        if (currentState.actions.length) {
          const reactEffectActions = currentState.actions.filter(
            (
              action
            ): action is ReactActionObject<TContext, TEvent, TAction> => {
              return (
                typeof (action as any).exec === 'function' &&
                '__effect' in
                  (action as ReactActionObject<TContext, TEvent, TAction>).exec
              );
            }
          );

          const [effectActions, layoutEffectActions] = partition(
            reactEffectActions,
            (
              action
            ): action is ReactActionObject<TContext, TEvent, TAction> => {
              return action.exec.__effect === ReactEffectType.Effect;
            }
          );

          effectActionsRef.current.push(
            ...effectActions.map<ActionStateTuple<TContext, TEvent, TAction>>(
              (effectAction) => [effectAction, currentState]
            )
          );

          layoutEffectActionsRef.current.push(
            ...layoutEffectActions.map<
              ActionStateTuple<TContext, TEvent, TAction>
            >((layoutEffectAction) => [layoutEffectAction, currentState])
          );
        }
      })
      .start(rehydratedState ? State.create(rehydratedState) : undefined);

    return () => {
      service.stop();
    };
  }, []);

  // Make sure actions and services are kept updated when they change.
  // This mutation assignment is safe because the service instance is only used
  // in one place -- this hook's caller.
  useEffect(() => {
    Object.assign(service.machine.options.actions, actions);
  }, [actions]);

  useEffect(() => {
    Object.assign(service.machine.options.services, services);
  }, [services]);

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
