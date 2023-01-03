import {
  Action,
  ActorContext,
  ActorRef,
  AnyBehavior,
  BaseActionObject,
  DynamicActionObject,
  EventFrom,
  Implementations,
  InternalStateFrom,
  MachineBehavior,
  MachineState,
  MachineTypes,
  StateMachineConfig
} from './types';

export function assign<T extends MachineTypes>(
  assignments: any
): DynamicActionObject<T> {
  return {
    type: 'xstate.assign',
    params: assignments,
    resolve: (state, eventObject) => {
      let tmpContext = { ...state.context };

      if (typeof assignments === 'function') {
        tmpContext = assignments(state.context, eventObject);
      } else {
        Object.keys(assignments).forEach((key: keyof T['context']) => {
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

// export function invoke(behavior: AnyBehavior): DynamicActionObject {
//   return {
//     type: 'xstate.invoke',
//     params: behavior,
//     resolve: (state, eventObject, actorCtx) => {
//       const actor = interpret(behavior as any);
//       return [state, { type: 'xstate.invoke', params: { ref: actor } }];
//     }
//   };
// }

function toActionObject<T extends MachineTypes>(
  action: Action<T>,
  actionImpls?: Implementations<T>['actions']
): DynamicActionObject<any> | BaseActionObject {
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

export function createMachine<T extends MachineTypes>(
  machine: StateMachineConfig<T>,
  implementations: Implementations<T> = {}
): MachineBehavior<T> {
  const initialStateNode = machine.initial
    ? machine.states?.[machine.initial]
    : undefined;
  const initialActions =
    toArray(initialStateNode?.entry ?? []).map((action) =>
      toActionObject(action, implementations?.actions)
    ) ?? [];
  let initialState: MachineState<T> = {
    value: machine.initial,
    context: machine.context ?? {},
    actions: initialActions,
    changed: false
  };

  for (let actionObject of initialActions) {
    // const actionObject: BaseActionObject =
    //   typeof action === 'string' ? { type: action } : action;
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
    transition: (
      state,
      event,
      actorCtx?: ActorContext<MachineBehavior<T>>
    ): MachineState<T> => {
      const stateNode = machine.states?.[state.value];
      if (!stateNode) {
        throw new Error(
          `State node not found for state value '${state.value}'`
        );
      }
      const transition =
        event.type === 'done'
          ? stateNode.invoke?.onDone
          : stateNode?.on?.[(event as T['events']).type];

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
        const stateChanged = nextValue !== state.value;
        const stateToEnter = stateChanged
          ? machine.states?.[nextValue]
          : undefined;
        const stateToExit = stateChanged
          ? machine.states?.[state.value]
          : undefined;
        const entryActions = toArray(stateToEnter?.entry) ?? [];
        const exitActions = toArray(stateToExit?.exit) ?? [];
        const transitionActions = toArray(transitionObject.actions) ?? [];
        const invokeActions = toArray(stateToEnter?.invoke).map((i) => ({
          type: 'xstate.invoke',
          execute: () => {
            console.log('executing...', i);

            const actorRef = interpret(i.src);
            // @ts-ignore
            actorRef.parent = actorCtx?.self;

            actorRef.start();
          }
        }));

        const allActions = [
          ...exitActions,
          ...transitionActions,
          ...invokeActions,
          ...entryActions
        ];

        let nextState: MachineState<T> = {
          value: transitionObject.target ?? state.value,
          context: state.context,
          actions: allActions.map((a) =>
            toActionObject(a, implementations.actions)
          ),
          changed: false
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

        nextState.changed =
          nextState.value !== state.value || allActions.length > 0;

        return nextState;
      }

      return state;
    },
    initialState,
    provide: (providedImpls) => {
      return createMachine(machine, providedImpls);
    },
    implementations: implementations ?? {},
    getSnapshot: (state) => state
  };
}

export function interpret<TBehavior extends AnyBehavior>(
  behavior: TBehavior
): ActorRef<TBehavior> {
  let currentState = behavior.initialState;
  const observers = new Set<any>();

  function update(state: InternalStateFrom<TBehavior>) {
    currentState = state;

    state.actions.forEach((action) => {
      action.execute?.();
    });

    observers.forEach((observer) => observer.next(currentState));
  }

  const actorRef: ActorRef<TBehavior> = {
    start: (restoredState) => {
      const preInitialState = restoredState ?? behavior.initialState;
      const startState = behavior.start
        ? behavior.start(preInitialState, { self: actorRef })
        : preInitialState;
      update(startState);
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
      currentState = behavior.transition(currentState, event, {
        self: actorRef
      });

      try {
        currentState.actions.forEach((action) => {
          action.execute?.();
        });
      } catch (e) {
        // gulp
      }

      update(currentState);
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
