import {
  DynamicActionObject,
  ActionFunction,
  BaseActionObject,
  ActionImplementionMap,
  MachineConfig,
  Assigner,
  PropertyAssigner,
  InferNarrowestObject,
  Implementations,
  StateMachine,
  StateNode,
  StateNodeConfig,
  TransitionObject,
  TransitionConfig,
  StateFrom,
  Interpreter,
  Executor
} from './types';

export type SingleOrArray<T> = T[] | T;

export function toActionObject<TMachine>(
  action:
    | string
    | DynamicActionObject<TMachine>
    | ActionFunction<TMachine>
    | BaseActionObject,
  actionMap: ActionImplementionMap<TMachine> | undefined
) {
  action =
    typeof action === 'string' && actionMap && actionMap[action]
      ? actionMap[action]
      : action;
  return typeof action === 'string'
    ? {
        type: action
      }
    : typeof action === 'function'
    ? '__xstate' in action
      ? action
      : {
          type: action.name
        }
    : action;
}

export function assign<TMachine extends MachineConfig<any>, TEvent>(
  assignment: Assigner<TMachine, TEvent> | PropertyAssigner<TMachine, TEvent>
): DynamicActionObject<TMachine, TEvent> {
  const assignAction = function resolveAssign(ctx, eventObject) {
    if (typeof assignment === 'function') {
      return assignment(ctx, eventObject);
    }
    const tmpContext = { ...ctx };

    Object.keys(assignment).forEach((key) => {
      const assigner = assignment[key as keyof typeof assignment];
      tmpContext[key] =
        typeof assigner === 'function' ? assigner(ctx, eventObject) : assigner;
    });

    return tmpContext;
  };

  // @ts-ignore
  assignAction.type = 'xstate.assign' as const;
  assignAction.__xstate = true as true;
  return assignAction;
}

function toArray<T>(item: T | T[] | undefined): T[] {
  return item === undefined ? [] : ([] as T[]).concat(item);
}

export function createMachine<T extends MachineConfig<T>>(
  config: InferNarrowestObject<T>,
  implementations?: Implementations<T>
): StateMachine<T> {
  const states: Record<string, StateNode> = {};
  const actionImpls: Implementations<T>['actions'] = {
    ...implementations?.actions
  };

  if (config.states) {
    Object.entries(
      config.states as Record<string, StateNodeConfig<any, any>>
    ).forEach(([key, stateConfig]) => {
      const transitionMap: Record<string, TransitionObject[]> = {};

      const toTransitionObject = (t, eventType) => {
        return typeof t === 'string'
          ? { target: t }
          : {
              target: t.target,
              actions: t.actions
                ? toArray(t.actions).map((action, i) => {
                    if (
                      typeof action === 'function' &&
                      !('__xstate' in action)
                    ) {
                      const actionType = `${key}:${eventType}:${i}`;
                      actionImpls[actionType] = action;

                      return { type: actionType };
                    }
                    return toActionObject(action, {});
                  })
                : undefined,
              guard: t.guard
            };
      };

      if (stateConfig.on) {
        Object.entries(
          stateConfig.on as Record<
            string,
            SingleOrArray<TransitionConfig<any, any>>
          >
        ).map(([eventType, transitionConfig]) => {
          const transitions = toArray(transitionConfig);
          transitionMap[eventType] = transitions.map((t) =>
            toTransitionObject(t, eventType)
          );
        });
      }

      if (stateConfig.invoke?.onDone) {
        transitionMap[`done.invoke.${stateConfig.invoke.id}`] = [
          toTransitionObject(
            stateConfig.invoke.onDone,
            `done.invoke.${stateConfig.invoke.id}`
          )
        ];
      }
      states[key] = {
        entry: stateConfig.entry
          ? toArray(stateConfig.entry).map((action, i) => {
              if (typeof action === 'function' && !('__xstate' in action)) {
                const actionType = `${key}::entry:${i}`;
                actionImpls[actionType] = action;

                return { type: actionType };
              }
              return toActionObject(action, {});
            })
          : undefined,
        exit: stateConfig.exit
          ? toArray(stateConfig.exit).map((action, i) => {
              if (typeof action === 'function' && !('__xstate' in action)) {
                const actionType = `${key}::exit:${i}`;
                actionImpls[actionType] = action;

                return { type: actionType };
              }
              return toActionObject(action, {});
            })
          : undefined,
        invoke: stateConfig.invoke,
        on: transitionMap
      };
    });
  }

  const machine: StateMachine<T> = {
    states,
    transition: (state, eventObject, execute) => {
      if (state.value === null) {
        return state;
      }

      const stateNodeObject = machine.states[state.value as string];

      if (!stateNodeObject) {
        throw new Error(`Invalid state value: ${state.value as string}`);
      }

      if (stateNodeObject?.on) {
        const transitions = toArray(stateNodeObject.on[eventObject.type] ?? []);

        for (const transitionObject of transitions) {
          const { target = state.value as string, guard } = transitionObject;

          if (guard && !guard(state.context, eventObject)) {
            continue;
          }

          const nextStateNodeObject = target
            ? machine.states?.[target]
            : undefined;

          if (target && !nextStateNodeObject) {
            throw new Error(`Invalid next state value: ${target}`);
          }

          const actions: any[] = [];
          if (nextStateNodeObject?.invoke) {
            actions.push({
              type: 'xstate.start',
              invoke: nextStateNodeObject.invoke
            });
          }

          if (target !== state.value) {
            actions.push(
              ...(stateNodeObject.exit ?? []),
              ...(transitionObject.actions ?? []),
              ...(nextStateNodeObject!.entry ?? [])
            );
          } else {
            actions.push(...(transitionObject.actions ?? []));
          }

          let nextContext = state.context;

          for (const action of actions) {
            if (action.type === 'xstate.assign') {
              nextContext = action(nextContext, eventObject);
            } else {
              execute?.(action, nextContext, eventObject, {
                actions: actionImpls
              });
            }
          }

          return {
            value: target,
            actions,
            context: nextContext
          } as StateFrom<T>;
        }
      }

      // INITIAL STATE
      if (eventObject.type === 'xstate.init') {
        let nextContext = state.context;

        for (const action of state.actions) {
          if (action.type === 'xstate.assign') {
            nextContext = action(nextContext, eventObject);
          } else {
            execute?.(action, nextContext, eventObject, {
              actions: actionImpls
            });
          }
        }

        return {
          ...state,
          context: nextContext
        };
      }

      return state;
    },
    get initialState() {
      return machine.transition(
        {
          value: config.initial ?? null,
          actions: config.initial
            ? states[config.initial as string].entry ?? []
            : [],
          context: config.context as any
        },
        { type: 'xstate.init' } as any
      );
    },
    getInitialState: (exec) => {
      return machine.transition(
        {
          value: config.initial ?? null,
          actions: config.initial
            ? states[config.initial as string].entry ?? []
            : [],
          context: config.context as any
        },
        { type: 'xstate.init' } as any,
        exec
      );
    }
  };

  return machine;
}

export function interpret<T extends StateMachine<any>>(
  machine: T
): Interpreter {
  let state: StateFrom<T>;
  const observers = new Set<any>();
  let status = 0;

  const executor: Executor<T> = (action, ctx, event, implementations) => {
    const implementation = implementations?.actions?.[action.type];

    if (implementation) {
      implementation(ctx, event as any);
    }
  };

  const self: Interpreter = {
    start: (restoredState?: StateFrom<T>) => {
      status = 1;
      state = restoredState ?? machine.getInitialState(executor);
      observers.forEach((obs) => obs.next(state));
      return self;
    },
    send: (event: any) => {
      if (status !== 1) {
        return;
      }

      state = machine.transition(state, event, executor);

      state.actions.forEach((action) => {
        if (action.type === 'xstate.start') {
          const { src } = action.invoke;

          const srcBehavior = typeof src === 'function' ? src() : src;
          const actorRef = srcBehavior.start();

          actorRef.subscribe({
            next: (data) => {
              self.send({
                type: `done.invoke.${action.invoke.id}`,
                data
              } as any);
            }
          });
        }
      });

      observers.forEach((obs) => obs.next(state));
    },
    subscribe: (obs) => {
      const observer = typeof obs === 'function' ? { next: obs } : obs;

      observers.add(observer);

      observer.next(state);

      return {
        unsubscribe: () => {
          observers.delete(observer);
        }
      };
    },
    getSnapshot: () => state
  };

  return self;
}
