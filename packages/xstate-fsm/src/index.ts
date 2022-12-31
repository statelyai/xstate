import { SingleOrArray } from './types';

interface EventObject {
  type: string;
}

interface MachineTypes {
  context: Record<string, any>;
  events: EventObject;
}

interface Behavior<TEvent extends EventObject, _TSnapshot, TInternalState> {
  transition: (state: TInternalState, event: TEvent) => TInternalState;
  initialState: TInternalState;
}

type AnyBehavior = Behavior<any, any, any>;

type EventFrom<T extends AnyBehavior> = T extends Behavior<
  infer TEvent,
  any,
  any
>
  ? TEvent
  : never;

// type SnapshotFrom<T extends AnyBehavior> = T extends Behavior<
//   any,
//   infer TSnapshot,
//   any
// >
//   ? TSnapshot
//   : never;

// type InternalStateFrom<T extends AnyBehavior> = T extends Behavior<
//   any,
//   any,
//   infer TInternalState
// >
//   ? TInternalState
//   : never;

interface MachineState {
  value: string;
  context: Record<string, any>;
  actions: BaseActionObject[];
  changed: boolean;
}

type Action = string | (() => void) | BaseActionObject | DynamicActionObject;

export interface FSM<T extends MachineTypes> {
  initial: string;
  context?: T['context'];
  states?: {
    [key: string]: {
      entry?: SingleOrArray<Action>;
      exit?: SingleOrArray<Action>;
      on?: {
        [K in T['events']['type']]?:
          | string
          | {
              target?: string;
              guard?: (
                context: T['context'],
                event: T['events'] & { type: K }
              ) => boolean;
              actions?: SingleOrArray<Action>;
            };
      };
    };
  };
  implementations?: Implementations;
}

interface BaseActionObject {
  type: string;
  params?: Record<string, any>;
  execute?: () => void;
  resolve?: (
    state: MachineState,
    event: EventObject
  ) => [MachineState, BaseActionObject];
}

interface DynamicActionObject {
  type: string;
  params: Record<string, any>;
  resolve: (
    state: MachineState,
    event: EventObject
  ) => [MachineState, BaseActionObject];
}

export function assign(assignments: any): DynamicActionObject {
  return {
    type: 'xstate.assign',
    params: assignments,
    resolve: (state, eventObject) => {
      let tmpContext = { ...state.context };

      if (typeof assignments === 'function') {
        tmpContext = assignments(state.context, eventObject);
      } else {
        Object.keys(assignments).forEach((key) => {
          tmpContext[key] =
            typeof assignments[key] === 'function'
              ? assignments[key](state.context, eventObject)
              : assignments[key];
        });
      }
      const nextState = {
        ...state,
        context: tmpContext
      };
      return [nextState, { type: 'xstate.assign', params: assignments }];
    }
  };
}

function toActionObject(
  action: Action,
  actionImpls?: Implementations['actions']
): BaseActionObject {
  if (typeof action === 'string') {
    return actionImpls?.[action]
      ? toActionObject(actionImpls[action], actionImpls)
      : { type: action };
  }

  if (typeof action === 'function') {
    return {
      type: 'xstate.function',
      execute: action
    };
  }
  return action;
}

type Implementations = {
  actions?: {
    [key: string]: Action;
  };
};

type MachineBehavior<T extends MachineTypes> = Behavior<
  T['events'],
  MachineState,
  MachineState
> & {
  config: FSM<T>;
  provide: (implementations: {
    actions?: {
      [key: string]: Action;
    };
  }) => MachineBehavior<T>;
  implementations: Implementations;
};

export function createMachine<T extends MachineTypes>(
  machine: FSM<T>
): MachineBehavior<T> {
  const initialStateNode = machine.initial
    ? machine.states?.[machine.initial]
    : undefined;
  let initialState: MachineState = {
    value: machine.initial,
    context: machine.context ?? {},
    actions:
      toArray(initialStateNode?.entry ?? []).map((a) =>
        toActionObject(a, machine.implementations?.actions)
      ) ?? [],
    changed: false
  };

  for (let action of initialState.actions) {
    const actionObject: BaseActionObject =
      typeof action === 'string' ? { type: action } : action;
    if (actionObject.resolve) {
      let resolvedActionObject;
      [initialState, resolvedActionObject] = actionObject.resolve(
        initialState,
        { type: 'xstate.init' }
      );
      resolvedActionObject;
    }
  }

  return {
    config: machine,
    transition: (state, event): MachineState => {
      const stateNode = machine.states?.[state.value];
      if (!stateNode) {
        throw new Error(
          `State node not found for state value '${state.value}'`
        );
      }
      const transition = stateNode?.on?.[(event as T['events']).type];
      if (!transition) {
        return { ...state, actions: [] };
      }

      const transitionObject =
        typeof transition === 'string' ? { target: transition } : transition;

      if (
        !transitionObject.guard ||
        transitionObject.guard(state.context, event)
      ) {
        const nextValue = transitionObject.target ?? state.value;
        if (!machine.states?.[nextValue]) {
          throw new Error(
            `State node not found for state value '${nextValue}'`
          );
        }
        const enteredState =
          nextValue !== state.value ? machine.states?.[nextValue] : undefined;
        const exitedState =
          nextValue !== state.value ? machine.states?.[state.value] : undefined;
        const entryActions = toArray(enteredState?.entry) ?? [];
        const exitActions = toArray(exitedState?.exit) ?? [];
        const transitionActions = toArray(transitionObject.actions) ?? [];

        const allActions = [
          ...exitActions,
          ...transitionActions,
          ...entryActions
        ];

        let nextState: MachineState = {
          value: transitionObject.target ?? state.value,
          context: state.context,
          actions: allActions.map((a) =>
            toActionObject(a, machine.implementations?.actions)
          ),
          changed: nextValue !== state.value || allActions.length > 0
        };

        for (let action of allActions) {
          const actionObject =
            typeof action === 'string' ? { type: action } : action;
          if (actionObject.resolve) {
            let resolvedActionObject;
            [nextState, resolvedActionObject] = actionObject.resolve(
              nextState,
              event
            );
            resolvedActionObject;
          }
        }

        return nextState;
      }

      return state;
    },
    initialState,
    provide: (implementations) => {
      return createMachine({
        ...machine,
        implementations
      });
    },
    implementations: machine.implementations ?? {}
  };
}

export function interpret<TBehavior extends MachineBehavior<any>>(
  behavior: TBehavior
) {
  let currentState = behavior.initialState;
  const observers = new Set<any>();

  function update(state: MachineState) {
    currentState = state;

    state.actions.forEach((action) => {
      action.execute?.();
    });

    observers.forEach((observer) => observer.next(currentState));
  }

  const actorRef = {
    start: (restoredState?: MachineState) => {
      update(restoredState ?? behavior.initialState);
      return actorRef;
    },
    subscribe: (observerOrFn) => {
      const observer =
        typeof observerOrFn === 'function'
          ? { next: observerOrFn }
          : observerOrFn;
      observers.add(observer);
      observer.next(currentState);
      return {
        unsubscribe: () => observers.delete(observer)
      };
    },
    send: (event: EventFrom<TBehavior>) => {
      currentState = behavior.transition(currentState, event);

      currentState.actions.forEach((action) => {
        action.execute?.();
      });
      observers.forEach((observer) => observer.next(currentState));
    },
    stop: () => {
      observers.forEach((observer) => observer.complete());
      observers.clear();
    },
    getSnapshot: () => currentState
  };

  return actorRef;
}

function toArray<T>(item: T | T[] | undefined): T[] {
  return item === undefined ? [] : ([] as T[]).concat(item);
}
