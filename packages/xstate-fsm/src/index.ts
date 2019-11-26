import {
  StateMachine,
  EventObject,
  Typestate,
  InterpreterStatus
} from './types';

export { StateMachine, EventObject, InterpreterStatus, Typestate };

function toArray<T>(item: T | T[] | undefined): T[] {
  return item === undefined ? [] : ([] as T[]).concat(item);
}

const assignActionType: StateMachine.AssignAction = 'xstate.assign';

export function assign<TC, TE extends EventObject = EventObject>(
  assignment:
    | StateMachine.Assigner<TC, TE>
    | StateMachine.PropertyAssigner<TC, TE>
): StateMachine.AssignActionObject<TC, TE> {
  return {
    type: assignActionType,
    assignment
  };
}

function toActionObject<TContext, TEvent extends EventObject>(
  // tslint:disable-next-line:ban-types
  action:
    | string
    | StateMachine.ActionFunction<TContext, TEvent>
    | StateMachine.ActionObject<TContext, TEvent>
) {
  return typeof action === 'string'
    ? { type: action }
    : typeof action === 'function'
    ? {
        type: action.name,
        exec: action
      }
    : action;
}

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

function createMatcher(value) {
  return stateValue => value === stateValue;
}

function toEventObject<TEvent extends EventObject>(
  event: TEvent['type'] | TEvent
): TEvent {
  return (typeof event === 'string' ? { type: event } : event) as TEvent;
}

function createUnchangedState<
  TC,
  TE extends EventObject,
  TS extends Typestate<TC>
>(value: string, context: TC): StateMachine.State<TC, TE, TS> {
  return {
    value,
    context,
    actions: [],
    changed: false,
    matches: createMatcher(value)
  };
}

export function createMachine<
  TContext extends object,
  TEvent extends EventObject = EventObject,
  TState extends Typestate<TContext> = any
>(
  fsmConfig: StateMachine.Config<TContext, TEvent>
): StateMachine.Machine<TContext, TEvent, TState> {
  return {
    initialState: {
      value: fsmConfig.initial,
      actions: toArray(fsmConfig.states[fsmConfig.initial].entry).map(
        toActionObject
      ),
      context: fsmConfig.context!,
      matches: createMatcher(fsmConfig.initial)
    },
    transition: (
      state: string | StateMachine.State<TContext, TEvent, TState>,
      event: string | Record<string, any> & { type: string }
    ): StateMachine.State<TContext, TEvent, TState> => {
      const { value, context } =
        typeof state === 'string'
          ? { value: state, context: fsmConfig.context! }
          : state;
      const eventObject = toEventObject(event);
      const stateConfig = fsmConfig.states[value];

      if (!IS_PRODUCTION) {
        if (!stateConfig) {
          throw new Error(
            `State '${value}' not found on machine${
              fsmConfig.id ? ` '${fsmConfig.id}'` : ''
            }.`
          );
        }
      }

      if (stateConfig.on) {
        const transitions = toArray(stateConfig.on[eventObject.type]);

        for (const transition of transitions) {
          if (transition === undefined) {
            return createUnchangedState(value, context);
          }

          const { target = value, actions = [], cond = () => true } =
            typeof transition === 'string'
              ? { target: transition }
              : transition;

          let nextContext = context;

          if (cond(context, eventObject)) {
            const nextStateConfig = fsmConfig.states[target];
            let assigned = false;
            const allActions = ([] as any[])
              .concat(stateConfig.exit, actions, nextStateConfig.entry)
              .filter(a => a)
              .map<StateMachine.ActionObject<TContext, TEvent>>(toActionObject)
              .filter(action => {
                if (action.type === assignActionType) {
                  assigned = true;
                  let tmpContext = Object.assign({}, nextContext);

                  if (typeof action.assignment === 'function') {
                    tmpContext = action.assignment(nextContext, eventObject);
                  } else {
                    Object.keys(action.assignment).forEach(key => {
                      tmpContext[key] =
                        typeof action.assignment[key] === 'function'
                          ? action.assignment[key](nextContext, eventObject)
                          : action.assignment[key];
                    });
                  }

                  nextContext = tmpContext;
                  return false;
                }
                return true;
              });

            return {
              value: target,
              context: nextContext,
              actions: allActions,
              changed: target !== value || allActions.length > 0 || assigned,
              matches: createMatcher(target)
            };
          }
        }
      }

      // No transitions match
      return createUnchangedState(value, context);
    }
  };
}

const executeStateActions = <
  TContext,
  TEvent extends EventObject = any,
  TState extends Typestate<TContext> = any
>(
  state: StateMachine.State<TContext, TEvent, TState>,
  event?: TEvent
) => state.actions.forEach(({ exec }) => exec && exec(state.context, event));

export function interpret<
  TContext,
  TEvent extends EventObject = EventObject,
  TState extends Typestate<TContext> = any
>(
  machine: StateMachine.Machine<TContext, TEvent, TState>
): StateMachine.Service<TContext, TEvent, TState> {
  let state = machine.initialState;
  let status = InterpreterStatus.NotStarted;
  const listeners = new Set<StateMachine.StateListener<typeof state>>();

  const service = {
    send: (event: TEvent | TEvent['type']): void => {
      if (status !== InterpreterStatus.Running) {
        return;
      }
      state = machine.transition(state, event);
      executeStateActions(state, toEventObject(event));
      listeners.forEach(listener => listener(state));
    },
    subscribe: (listener: StateMachine.StateListener<typeof state>) => {
      listeners.add(listener);
      listener(state);

      return {
        unsubscribe: () => listeners.delete(listener)
      };
    },
    start: () => {
      status = InterpreterStatus.Running;
      executeStateActions(state);
      return service;
    },
    stop: () => {
      status = InterpreterStatus.Stopped;
      listeners.forEach(listener => listeners.delete(listener));
      return service;
    },
    get status() {
      return status;
    }
  };

  return service;
}
