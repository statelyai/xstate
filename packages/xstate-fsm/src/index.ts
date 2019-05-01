export type SingleOrArray<T> = T[] | T;
export interface EventObject {
  type: string;
  [key: string]: any;
}

export interface ActionObject<TContext, TEvent> {
  type: string;
  exec?: (context: TContext, event: TEvent) => void;
  [key: string]: any;
}

export type Action<TContext, TEvent extends EventObject> =
  | TEvent['type']
  | ActionObject<TContext, TEvent>
  | ((context: TContext, event: TEvent) => void);

export namespace FSM {
  export type Transition<TContext, TEvent extends EventObject> =
    | string
    | {
        target?: string;
        actions?: SingleOrArray<Action<TContext, TEvent>>;
        cond?: (context: TContext, event: TEvent) => boolean;
      };
  export interface State<TContext, TEvent> {
    value: string;
    context: TContext;
    actions: Array<ActionObject<TContext, TEvent>>;
  }
}
export interface FSMConfig<TContext, TEvent extends EventObject> {
  initial: string;
  context?: TContext;
  states: {
    [key: string]: {
      on?: {
        [event: string]: SingleOrArray<FSM.Transition<TContext, TEvent>>;
      };
      exit?: SingleOrArray<Action<TContext, TEvent>>;
      entry?: SingleOrArray<Action<TContext, TEvent>>;
    };
  };
}

function toArray<T>(item: T | T[] | undefined): T[] {
  if (item === undefined) {
    return [];
  }
  return ([] as T[]).concat(item);
}

export function assign(assignment: any): ActionObject<any, any> {
  return {
    type: 'xstate.assign',
    assignment
  };
}

export function FSM<TContext, TEvent extends EventObject = EventObject>(
  fsmConfig: FSMConfig<TContext, TEvent>
) {
  return {
    initialState: {
      value: fsmConfig.initial,
      actions: toArray(fsmConfig.states[fsmConfig.initial].entry),
      context: fsmConfig.context
    },
    transition: (
      state: string | { value: string; context: any },
      event: string | Record<string, any> & { type: string }
    ): FSM.State<TContext, TEvent> => {
      const { value, context } =
        typeof state === 'string'
          ? { value: state, context: fsmConfig.context }
          : state;
      const eventObject = (typeof event === 'string'
        ? { type: event }
        : event) as TEvent;
      const stateConfig = fsmConfig.states[value];

      if (stateConfig.on) {
        const transitions = ([] as Array<
          FSM.Transition<TContext, TEvent>
        >).concat(stateConfig.on[eventObject.type]);

        for (const transition of transitions) {
          if (transition === undefined) {
            return { value, context, actions: [] };
          }

          const { target, actions = [], cond = () => true } =
            typeof transition === 'string'
              ? { target: transition }
              : transition;

          let nextContext = context;

          if (target && cond(context, eventObject)) {
            const nextStateConfig = fsmConfig.states[target];
            const allActions = ([] as any[])
              .concat(stateConfig.exit, actions, nextStateConfig.entry)
              .filter(Boolean)
              .map<ActionObject<TContext, TEvent>>(action =>
                typeof action === 'string'
                  ? { type: action }
                  : typeof action === 'function'
                  ? {
                      type: action.name,
                      exec: action
                    }
                  : action
              )
              .filter(action => {
                if (action.type === 'xstate.assign') {
                  let tmpContext = { ...nextContext };

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
              value: target ? target : value,
              context: nextContext,
              actions: allActions
            };
          }
        }
      }

      // No transitions match
      return { value, context, actions: [] };
    }
  };
}
