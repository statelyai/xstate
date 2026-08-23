import { XSTATE_INIT, XSTATE_STOP, XSTATE_TIMER } from './constants.ts';
import {
  appendFSMStarts,
  beginFSMEffects,
  createFSMEnqueue,
  createFSMSendEffect,
  finalizeFSMEffects,
  resolveFSMEffects,
  type FSMEffect
} from './fsm/effects.ts';
import { isLazyActorScope, withActorScope } from './actorScope.ts';
import type {
  ActorLogic,
  ActorScope,
  AnyActor,
  AnyActorScope,
  EnqueueObject,
  EventObject,
  ExecutableActionObject,
  MachineContext,
  LogicalTimer,
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
  timers: Record<string, LogicalTimer>;
  _nextTimerId: number;
  _nextActorIds?: Record<string, number>;
  _stateInput: Record<string, unknown> | undefined;
  machine: {
    id: string;
    sources: {
      actions: {};
      actors: {};
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
  enq: EnqueueObject<TEvent, EventObject>
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
  enq: EnqueueObject<TEvent, EventObject>
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
  type?: 'final';
  entry?:
    | FSMAction<TContext, TEvent, TState, TInput>
    | Array<FSMAction<TContext, TEvent, TState, TInput>>;
  exit?:
    | FSMAction<TContext, TEvent, TState, TInput>
    | Array<FSMAction<TContext, TEvent, TState, TInput>>;
  always?:
    | FSMTransition<TContext, TEvent, TState, TInput>
    | Array<FSMTransition<TContext, TEvent, TState, TInput>>;
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

const emptySources = {
  actions: {},
  actors: {},
  guards: {},
  delays: {}
};

const emptyExecutableActions: ExecutableActionObject[] = [];
const emptyFSMActions: FSMAction<any, any, any, any>[] = [];

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
    timers: {},
    _nextTimerId: 0,
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
    timers: snapshot.timers,
    _nextTimerId: snapshot._nextTimerId,
    // Carried across state changes: dropping these would let a later spawn
    // reuse the id of a still-running child.
    _nextActorIds: snapshot._nextActorIds,
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
    timers: snapshot.timers,
    _nextTimerId: snapshot._nextTimerId,
    _nextActorIds: snapshot._nextActorIds,
    _stateInput: snapshot._stateInput,
    machine: snapshot.machine
  } as FSMSnapshot<TContext, TState, TInput>;
}

function cleanupFSM(
  snapshot: FSMSnapshot<any, string, any>,
  actorScope: AnyActorScope
): [FSMSnapshot<any, string, any>, ExecutableActionObject[]] {
  const effects: FSMEffect[] = [];
  const enqueue = createFSMEnqueue(actorScope, effects, []);
  for (const child of Object.values(snapshot.children) as AnyActor[]) {
    enqueue.stop(child);
  }
  for (const id of Object.keys(snapshot.timers)) {
    enqueue.cancel(id);
  }
  return resolveFSMEffects(snapshot, effects, actorScope);
}

function completeFinalState(
  snapshot: FSMSnapshot<any, string, any>,
  event: EventObject,
  actorScope: AnyActorScope,
  internalQueue: EventObject[],
  states: Record<string, FSMStateConfig<any, any, string, any>>,
  runStateActions: (
    snapshot: FSMSnapshot<any, string, any>,
    event: EventObject,
    actorScope: AnyActorScope,
    actions: FSMStateConfig<any, any, string, any>['entry'],
    input: Record<string, unknown> | undefined,
    queue: EventObject[]
  ) => [FSMSnapshot<any, string, any>, ExecutableActionObject[]]
): [FSMSnapshot<any, string, any>, ExecutableActionObject[]] {
  const completed = {
    ...snapshot,
    status: 'done',
    output: undefined,
    error: undefined
  } as FSMSnapshot<any, string, any>;
  const [exited, exitEffects] = runStateActions(
    completed,
    event,
    actorScope,
    states[completed.value]?.exit,
    completed._stateInput,
    internalQueue
  );
  const [cleaned, cleanupEffects] = cleanupFSM(exited, actorScope);
  return [cleaned, [...exitEffects, ...cleanupEffects]];
}

function invalidStringTarget(path: string, target: string): never {
  throw new Error(
    `Invalid transition for "${path}": use { target: "${target}" } instead of a string target.`
  );
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
          invalidStringTarget(`${stateKey}.${eventType}`, transition as string);
        }
      }
    }
    if (stateConfig.always) {
      for (const transition of toArray(stateConfig.always)) {
        if (typeof transition === 'string') {
          invalidStringTarget(`${stateKey}.always`, transition as string);
        }
      }
    }
  }
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
    sources: emptySources
  };
  assertNoStringTransitions(config);

  const runActions = (
    snapshot: FSMSnapshot<TContext, string, TInput>,
    event: EventObject,
    actorScope: AnyActorScope,
    actionsConfig:
      | FSMAction<TContext, TEvent, string, TInput>
      | Array<FSMAction<TContext, TEvent, string, TInput>>
      | undefined,
    internalQueue: EventObject[]
  ): [FSMSnapshot<TContext, string, TInput>, ExecutableActionObject[]] => {
    if (!actionsConfig) {
      return [snapshot, emptyExecutableActions];
    }
    const effects: FSMEffect[] = [];
    const enqueue = createFSMEnqueue<TEvent>(
      actorScope,
      effects,
      internalQueue
    );
    let context = snapshot.context;
    for (const action of toArray(actionsConfig)) {
      const result = action(
        withActorScope(
          {
            context,
            event: event as TEvent,
            input: snapshot._stateInput,
            value: snapshot.value,
            children: snapshot.children
          },
          actorScope
        ) as any,
        enqueue
      );
      if (result?.context) {
        context = mergeContextPatch(context, result.context);
      }
    }
    return resolveFSMEffects(
      context === snapshot.context
        ? snapshot
        : cloneSnapshot(
            snapshot,
            snapshot.value,
            context,
            snapshot._stateInput
          ),
      effects,
      actorScope
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

    const actions: FSMEffect[] = [];
    const enq = createFSMEnqueue<TEvent>(actorScope, actions, internalQueue);
    let context: TContext | undefined;
    const actionCount = Array.isArray(actionsConfig) ? actionsConfig.length : 1;

    for (let i = 0; i < actionCount; i++) {
      const action = Array.isArray(actionsConfig)
        ? actionsConfig[i]
        : actionsConfig;
      const result = action(
        withActorScope(
          {
            context: context ?? snapshot.context,
            event: event as TEvent,
            input: stateInput as any,
            value: snapshot.value,
            children: snapshot.children
          },
          actorScope
        ),
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
    return resolveFSMEffects(nextSnapshot, actions, actorScope) as any;
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
      | undefined = event.type === '' ? state?.always : state?.on?.[event.type];

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
      const args = withActorScope(
        {
          context: snapshot.context,
          event,
          input: snapshot.input,
          value: snapshot.value,
          children: snapshot.children
        },
        actorScope
      );

      if (typeof transition === 'function') {
        const actions: FSMEffect[] = [];
        const enq = createFSMEnqueue<TEvent>(
          actorScope,
          actions,
          internalQueue
        );
        const result = transition(args, enq);
        if (!result) {
          if (actions.length) {
            return { effects: actions };
          }
          continue;
        }
        return {
          target: result.target,
          context: result.context,
          input: result.input,
          effects: actions
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
            : emptyFSMActions
      };
    }

    return undefined;
  };

  const transitionCore = (
    snapshot: FSMSnapshot<TContext, string, TInput>,
    event: TEvent,
    actorScope: ActorScope<
      FSMSnapshot<TContext, string, TInput>,
      TEvent,
      any,
      EventObject
    >
  ): [FSMSnapshot<TContext, string, TInput>, ExecutableActionObject[]] => {
    if (snapshot.status !== 'active') {
      return [snapshot, []];
    }
    if (event.type === XSTATE_STOP) {
      const [cleaned, cleanupEffects] = cleanupFSM(snapshot, actorScope);
      return [stopSnapshot(cleaned), cleanupEffects] as any;
    }
    if (event.type === XSTATE_TIMER) {
      const timer = snapshot.timers[(event as any).id];
      if (!timer) {
        return [snapshot, emptyExecutableActions];
      }
      const timers = { ...snapshot.timers };
      delete timers[timer.id];
      const nextSnapshot = { ...snapshot, timers };
      if (timer.type === '@xstate.raise') {
        return transitionCore(nextSnapshot, timer.event as TEvent, actorScope);
      }
      const target = timer.target === 'self' ? actorScope.self : timer.target;
      return [
        nextSnapshot,
        [createFSMSendEffect(actorScope, target, timer.event)]
      ];
    }

    const stateConfig = config.states[snapshot.value];
    const directTransition =
      event.type === '' ? stateConfig?.always : stateConfig?.on?.[event.type];
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
      const targetState = config.states[target];
      const stateChanged = target !== snapshot.value;
      if (
        targetState?.always ||
        (stateChanged &&
          (stateConfig.exit ||
            targetState?.entry ||
            targetState?.type === 'final'))
      ) {
        // Exit/entry actions need the general path.
      } else {
        const hasContext = directTransition.context !== undefined;
        const hasInput = directTransition.input !== undefined;
        const resolvedContext = !isLazyActorScope(actorScope)
          ? resolveTransitionContext(directTransition.context, {
              context: snapshot.context,
              event,
              input: snapshot.input,
              value: snapshot.value,
              self: actorScope.self,
              system: actorScope.system,
              parent: actorScope.self._parent,
              children: snapshot.children
            })
          : typeof directTransition.context === 'function'
            ? directTransition.context(
                withActorScope(
                  {
                    context: snapshot.context,
                    event,
                    input: snapshot.input,
                    value: snapshot.value,
                    children: snapshot.children
                  },
                  actorScope
                )
              )
            : directTransition.context;
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
        withActorScope(
          {
            context: snapshot.context,
            event,
            input: snapshot.input,
            value: snapshot.value,
            children: snapshot.children
          },
          actorScope
        ),
        undefined as any
      );
      if (result) {
        const target = result.target ?? snapshot.value;
        const targetState = config.states[target];
        if (
          !targetState?.entry &&
          !targetState?.always &&
          targetState?.type !== 'final'
        ) {
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
      const nextState = config.states[nextValue];
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

      const transitionResult: [
        FSMSnapshot<TContext, string, TInput>,
        ExecutableActionObject[]
      ] = selected.effects
        ? resolveFSMEffects(nextSnapshot, selected.effects, actorScope)
        : runActions(
            nextSnapshot,
            nextEvent,
            actorScope,
            selected.actions,
            internalQueue
          );
      const [afterTransition, transitionActions] = transitionResult;
      nextSnapshot = afterTransition;
      executableActions.push(...transitionActions);

      if (stateChanged) {
        const [entered, entryActions] = runStateActions(
          nextSnapshot,
          nextEvent,
          actorScope,
          nextState?.entry,
          stateInput,
          internalQueue
        );
        nextSnapshot = entered;
        executableActions.push(...entryActions);
      }

      if (nextState?.type === 'final') {
        const [completed, completionEffects] = completeFinalState(
          nextSnapshot,
          nextEvent,
          actorScope,
          internalQueue,
          config.states,
          runStateActions as any
        );
        nextSnapshot = completed;
        executableActions.push(...completionEffects);
        break;
      }
      if (nextState?.always) {
        internalQueue.unshift({ type: '' });
      }
    }

    return [nextSnapshot, executableActions];
  };

  const transition = ((...args: Parameters<typeof transitionCore>) => {
    beginFSMEffects(args[2], args[0]);
    const [nextSnapshot, effects] = transitionCore(...args);
    return finalizeFSMEffects(args[2], args[0], [
      nextSnapshot,
      appendFSMStarts(effects)
    ]);
  }) as FSMActorLogic<TContext, TEvent, string, TInput>['transition'];

  const logic: FSMActorLogic<TContext, TEvent, string, TInput> = {
    id: config.id,
    config,
    transition,
    initialTransition: (input, actorScope) => {
      const initialState = config.states[config.initial];
      const context = resolveContext(config.context, input);
      const snapshot = createSnapshot(
        config.initial,
        context,
        input,
        machine as any
      );
      beginFSMEffects(actorScope, snapshot);
      const internalQueue: EventObject[] = [];
      let [nextSnapshot, actions] = runStateActions(
        snapshot,
        { type: XSTATE_INIT },
        actorScope,
        initialState?.entry,
        undefined,
        internalQueue
      );
      if (!actions.length) {
        actions = [];
      }
      if (initialState?.type === 'final') {
        const [completed, completionEffects] = completeFinalState(
          nextSnapshot,
          { type: XSTATE_INIT },
          actorScope,
          internalQueue,
          config.states,
          runStateActions as any
        );
        nextSnapshot = completed;
        actions.push(...completionEffects);
      } else {
        if (initialState?.always) {
          internalQueue.unshift({ type: '' });
        }
        while (internalQueue.length) {
          const [raisedSnapshot, raisedActions] = transitionCore(
            nextSnapshot,
            internalQueue.shift()! as TEvent,
            actorScope
          );
          nextSnapshot = raisedSnapshot;
          actions.push(...raisedActions);
        }
      }
      return finalizeFSMEffects(actorScope, undefined, [
        nextSnapshot,
        appendFSMStarts(actions)
      ]);
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
