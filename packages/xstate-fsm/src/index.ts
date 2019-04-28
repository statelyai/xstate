export type SingleOrArray<T> = T[] | T;

export namespace FSM {
  export type Transition<TContext> =
    | string
    | {
        target?: string;
        actions?: SingleOrArray<string>;
        cond?: (context: TContext) => boolean;
      };
  export interface State<TContext> {
    value: string;
    context: TContext;
    actions: string[];
  }
}
export interface FSMConfig<TContext> {
  initial: string;
  context?: TContext;
  states: {
    [key: string]: {
      on?: {
        [event: string]: SingleOrArray<FSM.Transition<TContext>>;
      };
      exit?: SingleOrArray<any>;
      entry?: SingleOrArray<any>;
    };
  };
}

function toArray<T>(item: T | T[]): T[] {
  return ([] as T[]).concat(item);
}

export function FSM<TContext>(fsmConfig: FSMConfig<TContext>) {
  return {
    initialState: {
      value: fsmConfig.initial,
      actions: toArray(fsmConfig.states[fsmConfig.initial].entry),
      context: fsmConfig.context
    },
    transition: (
      state: string | { value: string; context: any },
      event: string | Record<string, any> & { type: string }
    ): FSM.State<TContext> => {
      const { value, context } =
        typeof state === 'string'
          ? { value: state, context: fsmConfig.context }
          : state;
      const eventObject = typeof event === 'string' ? { type: event } : event;
      const stateConfig = fsmConfig.states[value];

      if (stateConfig.on) {
        const transitions = ([] as Array<FSM.Transition<TContext>>).concat(
          stateConfig.on[eventObject.type]
        );

        for (const transition of transitions) {
          if (transition === undefined) {
            return { value, context, actions: [] };
          }

          const { target, actions = [], cond = () => true } =
            typeof transition === 'string'
              ? { target: transition }
              : transition;

          if (target && cond(context)) {
            const nextStateConfig = fsmConfig.states[target];
            const allActions = ([] as string[])
              .concat(stateConfig.exit)
              .concat(actions)
              .concat(nextStateConfig.entry)
              .filter(Boolean);
            return {
              value: target ? target : value,
              context,
              actions: allActions
            };
          }
        }

        return {
          value,
          context,
          actions: []
        };
      }

      return { value, context, actions: [] };
    }
  };
}
