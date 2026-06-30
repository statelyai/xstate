import { XSTATE_INIT, XSTATE_STOP } from './constants.ts';
import { builtInActions } from './actions.ts';
import {
  createTransitionEnqueue,
  resolveActionsWithContext
} from './transitionActions.ts';
import type {
  ActorLogic,
  ActorLogicTransitionResult,
  ActorScope,
  AnyAction,
  AnyActorScope,
  AnyEventObject,
  EventObject,
  ExecutableActionObject,
  MachineContext,
  NonReducibleUnknown,
  Snapshot
} from './types.ts';

export type FSMSnapshot<
  TContext extends MachineContext,
  TState extends string,
  TInput = unknown
> = Snapshot<undefined> & {
  value: TState;
  context: TContext;
  input: TInput | undefined;
  children: {};
  _stateInput: Record<string, unknown> | undefined;
  machine: {
    id: string;
    implementations: {
      actions: {};
      actorSources: {};
      guards: {};
      delays: {};
    };
  };
};

type FSMArgs<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TState extends string,
  TInput
> = {
  context: TContext;
  event: TEvent;
  input: TInput | undefined;
  value: TState;
  self: any;
  system: any;
  parent: any;
  children: {};
};

type FSMAction<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TState extends string,
  TInput
> = (
  args: FSMArgs<TContext, TEvent, TState, TInput> & {
    input: Record<string, unknown> | undefined;
  },
  enq: ReturnType<typeof createTransitionEnqueue>
) => void | { context?: FSMContextPatch<TContext> };

type FSMGuard<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TState extends string,
  TInput
> = (args: FSMArgs<TContext, TEvent, TState, TInput>) => boolean;

type FSMContextPatch<TContext extends MachineContext> = Partial<TContext> & {
  call?: never;
  apply?: never;
  bind?: never;
};

type FSMContextMapper<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TState extends string,
  TInput
> = (
  args: FSMArgs<TContext, TEvent, TState, TInput>
) => FSMContextPatch<TContext>;

type FSMTarget<TContext extends MachineContext> = {
  target?: string;
  context?: FSMContextPatch<TContext>;
  input?:
    | Record<string, unknown>
    | ((args: {
        context: TContext;
        event: EventObject;
      }) => Record<string, unknown>);
};

type FSMObjectTarget<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TState extends string,
  TInput
> = Omit<FSMTarget<TContext>, 'context'> & {
  context?:
    | FSMContextPatch<TContext>
    | FSMContextMapper<TContext, TEvent, TState, TInput>;
};

type FSMTransitionFunction<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TState extends string,
  TInput
> = (
  args: FSMArgs<TContext, TEvent, TState, TInput>,
  enq: ReturnType<typeof createTransitionEnqueue>
) => void | false | FSMTarget<TContext>;

type FSMTransition<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TState extends string,
  TInput
> =
  | FSMObjectTarget<TContext, TEvent, TState, TInput>
  | (FSMObjectTarget<TContext, TEvent, TState, TInput> & {
      guard?: FSMGuard<TContext, TEvent, TState, TInput>;
      actions?:
        | FSMAction<TContext, TEvent, TState, TInput>
        | Array<FSMAction<TContext, TEvent, TState, TInput>>;
    })
  | FSMTransitionFunction<TContext, TEvent, TState, TInput>;

type FSMStateConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TState extends string,
  TInput
> = {
  entry?:
    | FSMAction<TContext, TEvent, TState, TInput>
    | Array<FSMAction<TContext, TEvent, TState, TInput>>;
  exit?:
    | FSMAction<TContext, TEvent, TState, TInput>
    | Array<FSMAction<TContext, TEvent, TState, TInput>>;
  on?: Record<
    string,
    | FSMTransition<TContext, TEvent, TState, TInput>
    | Array<FSMTransition<TContext, TEvent, TState, TInput>>
  >;
};

export type FSMConfig<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TState extends string,
  TInput = NonReducibleUnknown
> = {
  id?: string;
  initial: TState;
  context?: TContext | ((args: { input: TInput }) => TContext);
  states: Record<TState, FSMStateConfig<TContext, TEvent, TState, TInput>>;
};

export type FSMActorLogic<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TState extends string,
  TInput
> = ActorLogic<
  FSMSnapshot<TContext, TState, TInput>,
  TEvent,
  TInput,
  any,
  EventObject
> & {
  id?: string;
};

const emptyImplementations = {
  actions: {},
  actorSources: {},
  guards: {},
  delays: {}
};

const emptyExecutableActions: ExecutableActionObject[] = [];
const emptyRawActions: AnyAction[] = [];
const builtInActionSet = new Set<(...args: any[]) => void>(
  Object.values(builtInActions)
);

function toArray<T>(value: T | T[] | undefined): T[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

function resolveContext<TContext extends MachineContext, TInput>(
  context: TContext | ((args: { input: TInput }) => TContext) | undefined,
  input: TInput
): TContext {
  return typeof context === 'function'
    ? (context as (args: { input: TInput }) => TContext)({ input })
    : (context ?? ({} as TContext));
}

function resolveTransitionContext<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TState extends string,
  TInput
>(
  context:
    | FSMContextPatch<TContext>
    | FSMContextMapper<TContext, TEvent, TState, TInput>
    | undefined,
  args: FSMArgs<TContext, TEvent, TState, TInput>
): FSMContextPatch<TContext> | undefined {
  return typeof context === 'function' ? context(args) : context;
}

function resolveInput(
  input: FSMTarget<any>['input'],
  context: MachineContext,
  event: EventObject
) {
  return typeof input === 'function' ? input({ context, event }) : input;
}

function mergeContextPatch<TContext extends MachineContext>(
  context: TContext,
  patch: FSMContextPatch<TContext>
): TContext {
  for (const key of Object.keys(patch) as Array<keyof TContext>) {
    if (
      !Object.prototype.hasOwnProperty.call(context, key) ||
      !Object.is(context[key], patch[key])
    ) {
      return { ...context, ...patch };
    }
  }

  return context;
}

function createSnapshot<
  TContext extends MachineContext,
  TState extends string,
  TInput
>(
  value: TState,
  context: TContext,
  input: TInput | undefined,
  machine: FSMSnapshot<TContext, TState, TInput>['machine'],
  stateInput?: Record<string, unknown>
): FSMSnapshot<TContext, TState, TInput> {
  return {
    status: 'active',
    output: undefined,
    error: undefined,
    value,
    context,
    input,
    children: {},
    _stateInput: stateInput,
    machine
  };
}

function cloneSnapshot<
  TContext extends MachineContext,
  TState extends string,
  TInput
>(
  snapshot: FSMSnapshot<TContext, TState, TInput>,
  value: TState,
  context: TContext,
  stateInput: Record<string, unknown> | undefined
): FSMSnapshot<TContext, TState, TInput> {
  return {
    status: snapshot.status,
    output: snapshot.output,
    error: snapshot.error,
    value,
    context,
    input: snapshot.input,
    children: snapshot.children,
    _stateInput: stateInput,
    machine: snapshot.machine
  } as FSMSnapshot<TContext, TState, TInput>;
}

function stopSnapshot<
  TContext extends MachineContext,
  TState extends string,
  TInput
>(
  snapshot: FSMSnapshot<TContext, TState, TInput>
): FSMSnapshot<TContext, TState, TInput> {
  return {
    status: 'stopped',
    output: undefined,
    error: undefined,
    value: snapshot.value,
    context: snapshot.context,
    input: undefined,
    children: snapshot.children,
    _stateInput: snapshot._stateInput,
    machine: snapshot.machine
  } as FSMSnapshot<TContext, TState, TInput>;
}

function assertNoStringTransitions(
  config: FSMConfig<any, any, string, any>
): void {
  for (const [stateKey, stateConfig] of Object.entries(config.states)) {
    for (const [eventType, transitionConfig] of Object.entries(
      stateConfig.on ?? {}
    )) {
      for (const transition of toArray(transitionConfig)) {
        if (typeof transition === 'string') {
          const target = transition as string;
          throw new Error(
            `Invalid transition for "${stateKey}.${eventType}": use { target: "${target}" } instead of a string target.`
          );
        }
      }
    }
  }
}

function resolveSimpleEnqueuedActions(
  rawActions: AnyAction[]
): ExecutableActionObject[] | undefined {
  const executableActions: ExecutableActionObject[] = [];

  for (const action of rawActions) {
    if (
      !action ||
      typeof action !== 'object' ||
      !('action' in action) ||
      typeof action.action !== 'function' ||
      builtInActionSet.has(action.action) ||
      '_special' in action.action
    ) {
      return undefined;
    }

    executableActions.push({
      type: action.action.name || '(anonymous)',
      params: undefined,
      args: action.args,
      exec: action.args.length
        ? action.action.bind(null, ...action.args)
        : action.action
    });
  }

  return executableActions;
}

export function createFSM<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TInput = NonReducibleUnknown
>(
  config: FSMConfig<TContext, TEvent, string, TInput>
): FSMActorLogic<TContext, TEvent, string, TInput> {
  const machine = {
    id: config.id ?? '(fsm)',
    implementations: emptyImplementations
  };
  assertNoStringTransitions(config);

  const runActions = (
    snapshot: FSMSnapshot<TContext, string, TInput>,
    event: EventObject,
    actorScope: AnyActorScope,
    rawActions: AnyAction[] | undefined
  ): [FSMSnapshot<TContext, string, TInput>, ExecutableActionObject[]] => {
    if (!rawActions?.length) {
      return [snapshot, emptyExecutableActions];
    }
    const simpleExecutableActions = resolveSimpleEnqueuedActions(rawActions);
    if (simpleExecutableActions) {
      return [snapshot, simpleExecutableActions];
    }
    return resolveActionsWithContext(
      snapshot as any,
      event as AnyEventObject,
      actorScope,
      rawActions
    ) as any;
  };

  const runStateActions = (
    snapshot: FSMSnapshot<TContext, string, TInput>,
    event: EventObject,
    actorScope: AnyActorScope,
    actionsConfig: FSMStateConfig<TContext, TEvent, string, TInput>['entry'],
    stateInput: Record<string, unknown> | undefined,
    internalQueue: EventObject[]
  ): [FSMSnapshot<TContext, string, TInput>, ExecutableActionObject[]] => {
    if (!actionsConfig) {
      return [snapshot, emptyExecutableActions];
    }

    const actions: AnyAction[] = [];
    const enq = createTransitionEnqueue(
      actorScope,
      actions,
      internalQueue,
      true
    );
    let context: TContext | undefined;
    const actionCount = Array.isArray(actionsConfig) ? actionsConfig.length : 1;

    for (let i = 0; i < actionCount; i++) {
      const action = Array.isArray(actionsConfig)
        ? actionsConfig[i]
        : actionsConfig;
      const result = action(
        {
          context: context ?? snapshot.context,
          event: event as TEvent,
          input: stateInput as any,
          value: snapshot.value,
          self: actorScope.self,
          system: actorScope.system,
          parent: actorScope.self._parent,
          children: snapshot.children
        },
        enq
      );
      if (result?.context !== undefined) {
        const currentContext = context ?? snapshot.context;
        const nextContext = mergeContextPatch(currentContext, result.context);
        if (nextContext !== currentContext) {
          context = nextContext;
        }
      }
    }

    const nextSnapshot =
      context !== undefined
        ? cloneSnapshot(snapshot, snapshot.value, context, snapshot._stateInput)
        : snapshot;
    return runActions(nextSnapshot, event, actorScope, actions);
  };

  const selectTransition = (
    snapshot: FSMSnapshot<TContext, string, TInput>,
    event: TEvent,
    actorScope: AnyActorScope,
    internalQueue: EventObject[]
  ) => {
    const state = config.states[snapshot.value];
    const transitionsConfig:
      | FSMTransition<TContext, TEvent, string, TInput>
      | Array<FSMTransition<TContext, TEvent, string, TInput>>
      | undefined = state?.on?.[event.type];

    if (!transitionsConfig) {
      return undefined;
    }

    const transitionCount = Array.isArray(transitionsConfig)
      ? transitionsConfig.length
      : 1;

    for (let i = 0; i < transitionCount; i++) {
      const transition = Array.isArray(transitionsConfig)
        ? transitionsConfig[i]
        : transitionsConfig;
      const args = {
        context: snapshot.context,
        event,
        input: snapshot.input,
        value: snapshot.value,
        self: actorScope.self,
        system: actorScope.system,
        parent: actorScope.self._parent,
        children: snapshot.children
      };

      if (typeof transition === 'function') {
        const actions: AnyAction[] = [];
        const enq = createTransitionEnqueue(
          actorScope,
          actions,
          internalQueue,
          true
        );
        const result = transition(args, enq);
        if (!result) {
          if (actions.length) {
            return { actions };
          }
          continue;
        }
        return {
          target: result.target,
          context: result.context,
          input: result.input,
          actions
        };
      }

      if (
        'guard' in transition &&
        transition.guard &&
        !transition.guard(args)
      ) {
        continue;
      }

      return {
        target: transition.target,
        context: resolveTransitionContext(transition.context, args),
        input: transition.input,
        actions:
          'actions' in transition && transition.actions
            ? toArray(transition.actions as any)
            : emptyRawActions
      };
    }

    return undefined;
  };

  const transition = ((
    snapshot: FSMSnapshot<TContext, string, TInput>,
    event: TEvent,
    actorScope: ActorScope<
      FSMSnapshot<TContext, string, TInput>,
      TEvent,
      any,
      EventObject
    >
  ): ActorLogicTransitionResult<FSMSnapshot<TContext, string, TInput>> => {
    if (snapshot.status !== 'active') {
      return [snapshot, []];
    }
    if (event.type === XSTATE_STOP) {
      return [stopSnapshot(snapshot), emptyExecutableActions] as any;
    }

    const stateConfig = config.states[snapshot.value];
    const directTransition = stateConfig?.on?.[event.type];
    if (!directTransition) {
      return [snapshot, emptyExecutableActions];
    }

    if (
      !Array.isArray(directTransition) &&
      typeof directTransition !== 'function' &&
      !('guard' in directTransition) &&
      !('actions' in directTransition && directTransition.actions) &&
      typeof directTransition.input !== 'function'
    ) {
      const target = directTransition.target ?? snapshot.value;
      const stateChanged = target !== snapshot.value;
      if (stateChanged && (stateConfig.exit || config.states[target]?.entry)) {
        // Exit/entry actions need the general path.
      } else {
        const hasContext = directTransition.context !== undefined;
        const hasInput = directTransition.input !== undefined;
        const resolvedContext = resolveTransitionContext(
          directTransition.context,
          {
            context: snapshot.context,
            event,
            input: snapshot.input,
            value: snapshot.value,
            self: actorScope.self,
            system: actorScope.system,
            parent: actorScope.self._parent,
            children: snapshot.children
          }
        );
        const context =
          hasContext && resolvedContext
            ? mergeContextPatch(snapshot.context, resolvedContext)
            : snapshot.context;
        if (
          !stateChanged &&
          context === snapshot.context &&
          !hasInput &&
          snapshot._stateInput === undefined
        ) {
          return [snapshot, emptyExecutableActions];
        }
        return [
          cloneSnapshot(
            snapshot,
            target,
            context,
            hasInput
              ? resolveInput(directTransition.input, context, event)
              : undefined
          ),
          emptyExecutableActions
        ];
      }
    }
    if (
      typeof directTransition === 'function' &&
      directTransition.length < 2 &&
      !stateConfig?.exit
    ) {
      const result = directTransition(
        {
          context: snapshot.context,
          event,
          input: snapshot.input,
          value: snapshot.value,
          self: actorScope.self,
          system: actorScope.system,
          parent: actorScope.self._parent,
          children: snapshot.children
        },
        undefined as any
      );
      if (result) {
        const target = result.target ?? snapshot.value;
        if (!config.states[target]?.entry) {
          const hasContext = result.context !== undefined;
          const hasInput = result.input !== undefined;
          const context =
            hasContext && result.context
              ? mergeContextPatch(snapshot.context, result.context)
              : snapshot.context;
          if (
            target === snapshot.value &&
            context === snapshot.context &&
            !hasInput &&
            snapshot._stateInput === undefined
          ) {
            return [snapshot, emptyExecutableActions];
          }
          return [
            cloneSnapshot(
              snapshot,
              target,
              context,
              hasInput ? resolveInput(result.input, context, event) : undefined
            ),
            emptyExecutableActions
          ];
        }
      }
    }

    let nextSnapshot: FSMSnapshot<TContext, string, TInput> = snapshot;
    const executableActions: ExecutableActionObject[] = [];
    const internalQueue: EventObject[] = [event];
    let iterations = 0;

    while (internalQueue.length) {
      if (++iterations > 1000) {
        throw new Error('FSM microstep count exceeded 1000');
      }
      const nextEvent = internalQueue.shift() as TEvent;
      const selected = selectTransition(
        nextSnapshot,
        nextEvent,
        actorScope,
        internalQueue
      );
      if (!selected) {
        continue;
      }

      const nextValue = selected.target ?? nextSnapshot.value;
      const stateChanged = nextValue !== nextSnapshot.value;

      if (stateChanged) {
        const [exited, exitActions] = runStateActions(
          nextSnapshot,
          nextEvent,
          actorScope,
          config.states[nextSnapshot.value]?.exit,
          nextSnapshot._stateInput,
          internalQueue
        );
        nextSnapshot = exited;
        executableActions.push(...exitActions);
      }

      let context = nextSnapshot.context;
      if (selected.context !== undefined) {
        context = mergeContextPatch(context, selected.context);
      }
      const hasInput = selected.input !== undefined;
      const stateInput = hasInput
        ? resolveInput(selected.input, context, nextEvent)
        : undefined;
      if (
        stateChanged ||
        context !== nextSnapshot.context ||
        hasInput ||
        nextSnapshot._stateInput !== undefined
      ) {
        nextSnapshot = cloneSnapshot(
          nextSnapshot,
          nextValue,
          context,
          stateInput
        );
      }

      const [afterTransition, transitionActions] = runActions(
        nextSnapshot,
        nextEvent,
        actorScope,
        selected.actions
      );
      nextSnapshot = afterTransition;
      executableActions.push(...transitionActions);

      if (stateChanged) {
        const [entered, entryActions] = runStateActions(
          nextSnapshot,
          nextEvent,
          actorScope,
          config.states[nextValue]?.entry,
          stateInput,
          internalQueue
        );
        nextSnapshot = entered;
        executableActions.push(...entryActions);
      }
    }

    return [nextSnapshot, executableActions as any];
  }) as FSMActorLogic<TContext, TEvent, string, TInput>['transition'];

  const logic: FSMActorLogic<TContext, TEvent, string, TInput> = {
    id: config.id,
    config,
    transition,
    initialTransition: (input, actorScope) => {
      const context = resolveContext(config.context, input);
      const snapshot = createSnapshot(
        config.initial,
        context,
        input,
        machine as any
      );
      const internalQueue: EventObject[] = [];
      let [nextSnapshot, actions] = runStateActions(
        snapshot,
        { type: XSTATE_INIT },
        actorScope,
        config.states[config.initial]?.entry,
        undefined,
        internalQueue
      );
      if (!actions.length) {
        actions = [];
      }
      while (internalQueue.length) {
        const [raisedSnapshot, raisedActions] = transition(
          nextSnapshot,
          internalQueue.shift()! as TEvent,
          actorScope
        );
        nextSnapshot = raisedSnapshot;
        actions.push(...(raisedActions as ExecutableActionObject[]));
      }
      return [nextSnapshot, actions as any];
    },
    getInitialSnapshot: (actorScope, input) =>
      logic.initialTransition(input, actorScope)[0],
    getPersistedSnapshot: ({ machine: _, ...snapshot }) => snapshot,
    restoreSnapshot: (snapshot) => ({
      ...(snapshot as FSMSnapshot<TContext, string, TInput>),
      machine: machine as any
    })
  };

  return logic;
}
