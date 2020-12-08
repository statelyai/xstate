import { useState, useEffect } from 'react';
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
  ActionObject,
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

export interface ReactActionFunction<TContext, TEvent extends EventObject> {
  (
    context: TContext,
    event: TEvent,
    meta: ActionMeta<TContext, TEvent>
  ): () => void;
  __effect: ReactEffectType;
}

export interface ReactActionObject<TContext, TEvent extends EventObject>
  extends ActionObject<TContext, TEvent> {
  exec: ReactActionFunction<TContext, TEvent>;
}

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
  State<TContext, TEvent>
];

function executeEffect<TContext, TEvent extends EventObject>(
  action: ReactActionObject<TContext, TEvent>,
  state: State<TContext, TEvent>
): void {
  const { exec } = action;
  const originalExec = exec!(state.context, state._event.data, {
    action,
    state,
    _event: state._event
  });

  originalExec();
}

function flushArray<T>(arr: T[]): T[] {
  const flushed = [...arr];
  arr.length = 0;
  return flushed;
}

function pushEffects(
  initial,
  current,
  scheduledEffectActions,
  scheduledLayoutEffectActions
) {
  if (initial) {
    current[1].push(...scheduledEffectActions);
    current[2].push(...scheduledLayoutEffectActions);
    return current;
  }
  const [
    currentState,
    currentEffectActions,
    currentLayoutEffectActions
  ] = current;
  return [
    currentState,
    currentEffectActions.concat(scheduledEffectActions),
    currentLayoutEffectActions.concat(scheduledLayoutEffectActions)
  ];
}

export type UseMachineOptions<
  TContext,
  TEvent extends EventObject,
  TTypestate extends Typestate<TContext>
> = {
  /**
   * If provided, will be _merged_ with machine's `context`.
   */
  context?: Partial<TContext>;
  /**
   * The state to rehydrate the machine to. The machine will
   * start at this state instead of its `initialState`.
   */
  state?: StateConfig<TContext, TEvent>;

  filter?: (
    state: State<TContext, TEvent, any, TTypestate>,
    prevState: State<TContext, TEvent, any, TTypestate>
  ) => boolean;
} & InterpreterOptions &
  MachineOptions<TContext, TEvent>;

export function useMachine<
  TContext,
  TEvent extends EventObject,
  TTypestate extends Typestate<TContext> = { value: any; context: TContext }
>(
  getMachine: MaybeLazy<StateMachine<TContext, any, TEvent, TTypestate>>,
  options: Partial<UseMachineOptions<TContext, TEvent, TTypestate>> = {}
): [
  State<TContext, TEvent, any, TTypestate>,
  Interpreter<TContext, any, TEvent, TTypestate>['send'],
  Interpreter<TContext, any, TEvent, TTypestate>
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
    filter,
    ...interpreterOptions
  } = options;

  const [resolvedMachine, service] = useConstant<
    [
      StateNode<TContext, any, TEvent, TTypestate>,
      Interpreter<TContext, any, TEvent, TTypestate>
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
      interpret(resolvedMachine, { deferEvents: true, ...interpreterOptions })
    ];
  });

  let [
    [state, currentEffectActions, currentLayoutEffectActions],
    setState
  ] = useState<
    [
      State<TContext, TEvent>,
      Array<[ReactActionObject<TContext, TEvent>, State<TContext, TEvent>]>,
      Array<[ReactActionObject<TContext, TEvent>, State<TContext, TEvent>]>
    ]
  >(() => {
    // Always read the initial state to properly initialize the machine
    // https://github.com/davidkpiano/xstate/issues/1334
    const { initialState } = resolvedMachine;
    return [
      rehydratedState ? State.create(rehydratedState) : initialState,
      [],
      []
    ];
  });

  useIsomorphicLayoutEffect(() => {
    let initial = true;
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

        if (
          (currentState.changed || initialStateChanged) &&
          // Only change the state if it is not filtered out
          (!filter || filter?.(currentState, currentState.history!))
        ) {
          setState(([, effectActions, layoutEffectActions]) => [
            currentState,
            effectActions,
            layoutEffectActions
          ]);
        }

        if (currentState.actions.length) {
          const reactEffectActions = currentState.actions.filter(
            (action): action is ReactActionObject<TContext, TEvent> => {
              return (
                typeof action.exec === 'function' &&
                '__effect' in
                  (action as ReactActionObject<TContext, TEvent>).exec
              );
            }
          );

          const [effectActions, layoutEffectActions] = partition(
            reactEffectActions,
            (action): action is ReactActionObject<TContext, TEvent> => {
              return action.exec.__effect === ReactEffectType.Effect;
            }
          );

          if (effectActions.length || layoutEffectActions.length) {
            const scheduledEffectActions = effectActions.map<
              ActionStateTuple<TContext, TEvent>
            >((effectAction) => [effectAction, currentState]);

            const scheduledLayoutEffectActions = layoutEffectActions.map<
              ActionStateTuple<TContext, TEvent>
            >((layoutEffectAction) => [layoutEffectAction, currentState]);

            setState((current) =>
              pushEffects(
                initial,
                current,
                scheduledEffectActions,
                scheduledLayoutEffectActions
              )
            );
          }
        }
      })
      .start(rehydratedState ? State.create(rehydratedState) : undefined);

    initial = false;

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
    currentEffectActions = flushArray(currentEffectActions);
    currentLayoutEffectActions = flushArray(currentLayoutEffectActions);

    while (currentLayoutEffectActions.length) {
      const [
        layoutEffectAction,
        effectState
      ] = currentLayoutEffectActions.shift()!;

      executeEffect(layoutEffectAction, effectState);
    }
  });

  useEffect(() => {
    while (currentEffectActions.length) {
      const [effectAction, effectState] = currentEffectActions.shift()!;

      executeEffect(effectAction, effectState);
    }
  });

  return [state, service.send, service];
}
