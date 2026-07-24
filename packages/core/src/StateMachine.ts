import isDevelopment from '#is-development';
import { $$ACTOR_TYPE, createActor } from './createActor.ts';
import { createErrorPlatformEvent, createInitEvent } from './eventUtils.ts';
import { XSTATE_TIMER } from './constants.ts';

import { createSpawner } from './spawn.ts';
import {
  attachSnapshotActorRef,
  createInertActorScope,
  isInertActorScope,
  setInertActorScopeSnapshot
} from './getNextSnapshot.ts';
import {
  createMachineSnapshot,
  cloneMachineSnapshot,
  getPersistedSnapshot,
  MachineSnapshot
} from './State.ts';
import { StateNode } from './StateNode.ts';
import {
  formatRouteTransitions,
  getAllStateNodes,
  getStateNodeByPath,
  getStateNodes,
  getTransitionResult,
  hasEffect,
  initialMicrostep,
  isInFinalState,
  isStateId,
  macrostep,
  resolveStateValue,
  transitionNode
} from './stateUtils.ts';
import {
  createSpawnEffect,
  resolveActionsWithContext
} from './transitionActions.ts';
import { AnyActorSystem } from './system.ts';
import type {
  ActorLogic,
  ActorLogicTransitionResult,
  ActorScope,
  AnyActor,
  AnyActorLogic,
  AnyActorRef,
  AnyActorScope,
  AnyEventObject,
  AnyMachineSnapshot,
  AnyTransitionDefinition,
  Equals,
  EventDescriptor,
  EmittedFrom,
  EventObject,
  EventFromLogic,
  ExecutableActionObject,
  ExecutableActionObjectFromLogic,
  HistoryValue,
  InputFrom,
  IsAny,
  LogicalTimer,
  MachineContext,
  MetaObject,
  OutputFrom,
  Snapshot,
  SnapshotFrom,
  StateValue,
  StateSchema,
  SnapshotStatus,
  AnyStateNode
} from './types.ts';
import {
  AnyMachineSchemas,
  Implementations,
  Next_MachineConfig,
  MachineOptions
} from './types.v6.ts';
import {
  matchesEventDescriptor,
  resolveReferencedActor,
  toStatePath
} from './utils.ts';

const STATE_IDENTIFIER = '#';

let emptyCanActor: AnyActor | undefined;
let emptyCanActorScope: AnyActorScope | undefined;

function getEmptyCanActor(): AnyActor {
  // A minimal inert actor used purely as the `self`/`parent` argument when
  // dry-running transitions for `snapshot.can(...)`. Intentionally not built
  // on `createLogic` so `can()` does not pull that machinery into bundles.
  return (emptyCanActor ??= createActor({
    transition: (snapshot: any) => [snapshot, []],
    initialTransition: () => [
      { status: 'active', output: undefined, error: undefined },
      []
    ],
    getInitialSnapshot: () => ({
      status: 'active',
      output: undefined,
      error: undefined
    }),
    getPersistedSnapshot: (snapshot: any) => snapshot
  } as any) as AnyActor);
}

function getEmptyCanActorScope(): AnyActorScope {
  if (emptyCanActorScope) {
    return emptyCanActorScope;
  }

  const actor = getEmptyCanActor();
  emptyCanActorScope = {
    self: actor,
    logger: () => {},
    id: '',
    sessionId: '',
    defer: () => {},
    system: actor.system,
    stopChild: () => {},
    emit: () => {},
    actionExecutor: () => {}
  };
  return emptyCanActorScope;
}

type CompatibleProvidedActorSource<
  TExpected extends AnyActorLogic,
  TActual extends AnyActorLogic
> =
  IsAny<TActual> extends true
    ? TActual
    : [OutputFrom<TActual>] extends [OutputFrom<TExpected>]
      ? [Omit<SnapshotFrom<TActual>, 'input'>] extends [
          Omit<SnapshotFrom<TExpected>, 'input'>
        ]
        ? [InputFrom<TExpected>] extends [InputFrom<TActual>]
          ? [EventFromLogic<TExpected>] extends [EventFromLogic<TActual>]
            ? [EmittedFrom<TActual>] extends [EmittedFrom<TExpected>]
              ? TActual
              : never
            : never
          : never
        : never
      : never;

type ProvidedActorSources<
  TExpectedActorMap extends Implementations['actorSources'],
  TProvidedActorMap extends Partial<
    Record<keyof TExpectedActorMap & string, AnyActorLogic>
  >
> = {
  [K in keyof TProvidedActorMap]: K extends keyof TExpectedActorMap
    ? TProvidedActorMap[K] extends AnyActorLogic
      ? CompatibleProvidedActorSource<
          TExpectedActorMap[K],
          TProvidedActorMap[K]
        >
      : never
    : never;
};

export class StateMachine<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TChildren extends Record<string, AnyActorRef | undefined>,
  TStateValue extends StateValue,
  TTag extends string,
  TInput,
  TOutput,
  TEmitted extends EventObject,
  TMeta extends MetaObject,
  TConfig extends StateSchema,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actorSources'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays']
> implements
    ActorLogic<
      MachineSnapshot<
        TContext,
        TEvent,
        TChildren,
        TStateValue,
        TTag,
        TOutput,
        TMeta,
        TConfig
      >,
      TEvent,
      TInput,
      AnyActorSystem,
      TEmitted
    >
{
  /** The machine's own version. */
  public version?: string;

  public schemas: AnyMachineSchemas | undefined;

  public implementations: Implementations;

  /** Runtime options for machine execution. */
  public options: MachineOptions;

  /** @internal */
  public idMap: Map<string, AnyStateNode> = new Map();

  public root: StateNode<TContext, TEvent>;

  public id: string;

  public states: StateNode<TContext, TEvent>['states'];
  public events: Array<EventDescriptor<TEvent>>;
  public internalEventDescriptors: ReadonlyArray<string>;
  constructor(
    /** The raw config used to create the machine. */
    public config: Next_MachineConfig<
      any,
      any,
      any,
      any,
      any,
      any,
      any,
      any,
      any,
      any,
      any // TEmitted
    > & {
      schemas?: AnyMachineSchemas;
      internalEvents?: readonly string[];
    },
    implementations?: Implementations
  ) {
    this.id = config.id || '(machine)';
    this.implementations = {
      actorSources: config.actorSources ?? {},
      actions: config.actions ?? {},
      delays: (config.delays ?? {}) as Implementations['delays'],
      guards: config.guards ?? {},
      ...implementations
    };
    if (isDevelopment) {
      // The `@xstate.` prefix is reserved for built-in serialized action and
      // guard descriptors — user implementation names must not collide.
      for (const kind of [
        'actions',
        'guards',
        'actorSources',
        'delays'
      ] as const) {
        for (const key of Object.keys(this.implementations[kind])) {
          if (key.startsWith('@xstate.')) {
            throw new Error(
              `Invalid ${kind} name '${key}': the '@xstate.' prefix is reserved for built-in descriptors.`
            );
          }
        }
      }
    }
    this.version = this.config.version;
    this.schemas = this.config.schemas;
    this.internalEventDescriptors = this.config.internalEvents ?? [];
    this.options = {
      maxIterations: Infinity,
      ...this.config.options
    };

    this.transition = this.transition.bind(this);
    this.initialTransition = this.initialTransition.bind(this);
    this.getInitialSnapshot = this.getInitialSnapshot.bind(this);
    this.getPersistedSnapshot = this.getPersistedSnapshot.bind(this);
    this.restoreSnapshot = this.restoreSnapshot.bind(this);
    this.start = this.start.bind(this);

    this.root = new StateNode(config as any, {
      _key: this.id,
      _machine: this as any
    });

    this.root._initialize();
    formatRouteTransitions(this.root);
    this.root._refreshEventMetadata();

    this.states = this.root.states; // TODO: remove!
    this.events = this.root.events;
  }

  /**
   * Clones this state machine with the provided implementations.
   *
   * @param implementations Options (`actions`, `guards`, `actorSources`,
   *   `delays`) to recursively merge with the existing options.
   * @returns A new `StateMachine` instance with the provided implementations.
   */
  public provide<
    const TProvidedActorMap extends Partial<
      Record<keyof TActorMap & string, AnyActorLogic>
    > = {}
  >(implementations: {
    actions?: Partial<TActionMap>;
    actorSources?: TProvidedActorMap &
      ProvidedActorSources<TActorMap, TProvidedActorMap>;
    guards?: Partial<TGuardMap>;
    delays?: Partial<TDelayMap>;
  }): StateMachine<
    TContext,
    TEvent,
    TChildren,
    TStateValue,
    TTag,
    TInput,
    TOutput,
    TEmitted,
    TMeta,
    TConfig,
    TActionMap,
    TActorMap,
    TGuardMap,
    TDelayMap
  > {
    const { actions, guards, actorSources, delays } = this.implementations;

    const provided = new StateMachine(this.config, {
      actions: {
        ...actions,
        ...implementations.actions
      } as Implementations['actions'],
      guards: {
        ...guards,
        ...implementations.guards
      } as Implementations['guards'],
      actorSources: {
        ...actorSources,
        ...implementations.actorSources
      } as Implementations['actorSources'],
      delays: {
        ...delays,
        ...implementations.delays
      } as Implementations['delays']
    }) as unknown as this;
    // Providing implementations does not change the serializable definition.
    provided._json = this._json;
    return provided;
  }

  public resolveState(
    config: {
      value: StateValue;
      context?: TContext;
      historyValue?: HistoryValue;
      status?: SnapshotStatus;
      output?: TOutput;
      error?: unknown;
    } & ([TContext] extends [never]
      ? {}
      : Equals<TContext, MachineContext> extends false
        ? { context: unknown }
        : {})
  ): MachineSnapshot<
    TContext,
    TEvent,
    TChildren,
    TStateValue,
    TTag,
    TOutput,
    TMeta,
    TConfig
  > {
    const resolvedStateValue = resolveStateValue(this.root, config.value);
    const nodeSet = getAllStateNodes(
      getStateNodes(this.root, resolvedStateValue)
    );
    const nodes = [...nodeSet];

    return createMachineSnapshot(
      {
        _nodes: nodes,
        value: resolvedStateValue,
        context: config.context || ({} as TContext),
        children: {},
        status: isInFinalState(nodeSet, this.root)
          ? 'done'
          : config.status || 'active',
        output: config.output,
        error: config.error,
        historyValue: config.historyValue
      },
      this
    ) as MachineSnapshot<
      TContext,
      TEvent,
      TChildren,
      TStateValue,
      TTag,
      TOutput,
      TMeta,
      TConfig
    >;
  }

  /**
   * Determines the next snapshot given the current `snapshot` and received
   * `event`. Calculates a full macrostep from all microsteps.
   *
   * @param snapshot The current snapshot
   * @param event The received event
   */
  public transition(
    snapshot: MachineSnapshot<
      TContext,
      TEvent,
      TChildren,
      TStateValue,
      TTag,
      TOutput,
      TMeta,
      TConfig
    >,
    event: TEvent,
    actorScope?: ActorScope<typeof snapshot, TEvent, AnyActorSystem, TEmitted>
  ): ActorLogicTransitionResult<
    MachineSnapshot<
      TContext,
      TEvent,
      TChildren,
      TStateValue,
      TTag,
      TOutput,
      TMeta,
      TConfig
    >,
    ExecutableActionObjectFromLogic<this>
  > {
    const usesInertScope = !actorScope;
    const resolvedActorScope = (actorScope ??
      createInertActorScope(
        this,
        snapshot as SnapshotFrom<this>
      )) as NonNullable<typeof actorScope>;
    if (usesInertScope) {
      setInertActorScopeSnapshot(resolvedActorScope, snapshot, false);
    }
    const fastSnapshot = this._transitionFast(
      snapshot,
      event,
      resolvedActorScope
    );
    if (fastSnapshot) {
      if (usesInertScope) {
        setInertActorScopeSnapshot(resolvedActorScope, fastSnapshot, false);
      }
      const returnedSnapshot =
        usesInertScope && fastSnapshot !== snapshot
          ? attachSnapshotActorRef(this, resolvedActorScope, fastSnapshot)
          : this._attachPureActorRef(fastSnapshot, resolvedActorScope);
      return [returnedSnapshot, []];
    }

    const { snapshot: nextSnapshot, microsteps } = macrostep(
      snapshot,
      event,
      resolvedActorScope,
      []
    );

    if (usesInertScope) {
      setInertActorScopeSnapshot(resolvedActorScope, nextSnapshot, false);
    }
    const returnedSnapshot = usesInertScope
      ? nextSnapshot === snapshot
        ? nextSnapshot
        : attachSnapshotActorRef(this, resolvedActorScope, nextSnapshot)
      : this._attachPureActorRef(nextSnapshot, resolvedActorScope);
    return [
      returnedSnapshot as MachineSnapshot<
        TContext,
        TEvent,
        TChildren,
        TStateValue,
        TTag,
        TOutput,
        TMeta,
        TConfig
      >,
      this._collectEffects(microsteps)
    ];
  }

  private _collectEffects(
    microsteps: ReadonlyArray<
      readonly [unknown, ReadonlyArray<ExecutableActionObject>]
    >
  ): ExecutableActionObjectFromLogic<this>[] {
    return microsteps.flatMap(
      ([, actions]) => actions
    ) as ExecutableActionObjectFromLogic<this>[];
  }

  private _attachPureActorRef<TSnapshot extends AnyMachineSnapshot>(
    snapshot: TSnapshot,
    actorScope: AnyActorScope
  ): TSnapshot {
    if (isInertActorScope(actorScope)) {
      return snapshot;
    }
    return attachSnapshotActorRef(this, actorScope, snapshot);
  }

  private _transitionFast(
    snapshot: MachineSnapshot<
      TContext,
      TEvent,
      TChildren,
      TStateValue,
      TTag,
      TOutput,
      TMeta,
      TConfig
    >,
    event: TEvent,
    actorScope: ActorScope<typeof snapshot, TEvent, AnyActorSystem, TEmitted>
  ):
    | MachineSnapshot<
        TContext,
        TEvent,
        TChildren,
        TStateValue,
        TTag,
        TOutput,
        TMeta,
        TConfig
      >
    | undefined {
    if (
      snapshot.status !== 'active' ||
      typeof snapshot.value !== 'string' ||
      this.root.always?.length
    ) {
      return undefined;
    }

    const sourceNode = this.root.states[snapshot.value];
    if (
      !sourceNode ||
      sourceNode.type !== 'atomic' ||
      sourceNode.exit ||
      sourceNode.invoke.length ||
      sourceNode.always?.length ||
      sourceNode.after?.length
    ) {
      return undefined;
    }

    const transitions = sourceNode.transitions.get(event.type);
    if (transitions?.length !== 1) {
      return undefined;
    }

    const selected = transitions[0];
    if (
      selected.guard ||
      selected.actions ||
      selected.to ||
      selected.reenter ||
      selected.input ||
      typeof selected.context === 'function' ||
      (selected.target && selected.target.length !== 1)
    ) {
      return undefined;
    }

    const targetNode = selected.target?.[0] ?? sourceNode;
    const stateChanged = targetNode !== sourceNode;
    if (
      targetNode.parent !== this.root ||
      targetNode.type !== 'atomic' ||
      (stateChanged &&
        (targetNode.entry ||
          targetNode.invoke.length ||
          targetNode.always?.length ||
          targetNode.after?.length))
    ) {
      return undefined;
    }

    const context =
      selected.context !== undefined
        ? ({ ...snapshot.context, ...selected.context } as TContext)
        : snapshot.context;

    const collectedMicrosteps =
      ((actorScope.self as any)._collectedMicrosteps as any[]) || [];
    collectedMicrosteps.push(selected);
    (actorScope.self as any)._collectedMicrosteps = collectedMicrosteps;

    return cloneMachineSnapshot(snapshot, {
      ...(context !== snapshot.context ? { context } : {}),
      ...(stateChanged ? { _nodes: [this.root, targetNode] } : {})
    });
  }

  /**
   * Determines the next state given the current `state` and `event`. Calculates
   * a microstep.
   *
   * @param state The current state
   * @param event The received event
   */
  public microstep(
    snapshot: MachineSnapshot<
      TContext,
      TEvent,
      TChildren,
      TStateValue,
      TTag,
      TOutput,
      TMeta,
      TConfig
    >,
    event: TEvent,
    actorScope: AnyActorScope
  ): Array<
    MachineSnapshot<
      TContext,
      TEvent,
      TChildren,
      TStateValue,
      TTag,
      TOutput,
      TMeta,
      TConfig
    >
  > {
    const { microsteps } = macrostep(snapshot, event, actorScope, []);
    const snapshots = new Array(microsteps.length);

    for (let i = 0; i < microsteps.length; i++) {
      snapshots[i] = microsteps[i][0];
    }

    return snapshots;
  }

  public getTransitionData(
    snapshot: MachineSnapshot<
      TContext,
      TEvent,
      TChildren,
      TStateValue,
      TTag,
      TOutput,
      TMeta,
      TConfig
    >,
    event: TEvent,
    self: AnyActor
  ): Array<AnyTransitionDefinition> {
    return (
      transitionNode(this.root, snapshot.value, snapshot, event, self) || []
    );
  }

  public isInternalEventType(eventType: string): boolean {
    if (eventType === XSTATE_TIMER) {
      return true;
    }
    for (const descriptor of this.internalEventDescriptors) {
      if (matchesEventDescriptor(eventType, descriptor)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Determines whether sending the `event` to the given snapshot would select a
   * non-forbidden transition. Backs `snapshot.can(...)`; lives here so that
   * non-machine bundles don't pay for the transition-resolution machinery.
   *
   * @internal
   */
  public _canTransition(snapshot: AnyMachineSnapshot, event: TEvent): boolean {
    const emptyActor = getEmptyCanActor();
    const emptyActorScope = getEmptyCanActorScope();
    const transitionData = this.getTransitionData(
      snapshot as any,
      event,
      emptyActor
    );

    if (!transitionData?.length) {
      return false;
    }

    // Check that at least one transition is not forbidden
    for (const transition of transitionData) {
      if (transition.target !== undefined) {
        return true;
      }

      const res = getTransitionResult(
        transition,
        snapshot,
        event,
        emptyActorScope,
        { resolveActions: false }
      );
      if (
        res.targets?.length ||
        res.context ||
        hasEffect(transition, snapshot.context, event, snapshot, emptyActor)
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Returns the error event that the actor should transition with to recover
   * from an execution error, if any active state node declares `onError`.
   *
   * @internal
   */
  public getExecutionErrorEvent(
    snapshot: MachineSnapshot<
      TContext,
      TEvent,
      TChildren,
      TStateValue,
      TTag,
      TOutput,
      TMeta,
      TConfig
    >,
    error: unknown
  ): TEvent | undefined {
    if (
      (snapshot as any)?.status !== 'active' ||
      !snapshot._nodes?.some((stateNode) => stateNode.config.onError)
    ) {
      return undefined;
    }
    return createErrorPlatformEvent('execution', error) as unknown as TEvent;
  }

  /**
   * The initial state _before_ evaluating any microsteps. This "pre-initial"
   * state is provided to initial actions executed in the initial state.
   *
   * @internal
   */
  _getPreInitialState(
    actorScope: AnyActorScope,
    initEvent: any
  ): MachineSnapshot<
    TContext,
    TEvent,
    TChildren,
    TStateValue,
    TTag,
    TOutput,
    TMeta,
    TConfig
  > {
    const { context } = this.config;

    const preInitial = createMachineSnapshot(
      {
        context:
          typeof context !== 'function' && context ? context : ({} as TContext),
        _nodes: [this.root],
        children: {},
        status: 'active'
      },
      this,
      actorScope.self
    );

    if (typeof context === 'function') {
      const children = {};
      const spawn = createSpawner(
        actorScope,
        this.implementations.actorSources,
        children
      );
      const resolvedContext = context({
        spawn,
        input: initEvent.input,
        self: actorScope.self,
        actorSources: this.implementations.actorSources
      });
      const [nextState] = resolveActionsWithContext(
        preInitial,
        initEvent,
        actorScope,
        []
      ) as any;
      if (resolvedContext) {
        nextState.context = resolvedContext;
      }
      if (Object.keys(children).length > 0) {
        nextState.children = {
          ...nextState.children,
          ...children
        };
      }
      return nextState as SnapshotFrom<this>;
    }

    return preInitial as SnapshotFrom<this>;
  }

  /**
   * Returns the initial `State` instance, with reference to `self` as an
   * `ActorRef`.
   */
  public getInitialSnapshot(
    actorScope?: ActorScope<
      MachineSnapshot<
        TContext,
        TEvent,
        TChildren,
        TStateValue,
        TTag,
        TOutput,
        TMeta,
        TConfig
      >,
      TEvent,
      AnyActorSystem,
      TEmitted
    >,
    input?: TInput
  ): MachineSnapshot<
    TContext,
    TEvent,
    TChildren,
    TStateValue,
    TTag,
    TOutput,
    TMeta,
    TConfig
  > {
    return this.initialTransition(input, actorScope)[0];
  }

  public initialTransition(
    input: TInput | undefined,
    actorScope?: ActorScope<
      MachineSnapshot<
        TContext,
        TEvent,
        TChildren,
        TStateValue,
        TTag,
        TOutput,
        TMeta,
        TConfig
      >,
      TEvent,
      AnyActorSystem,
      TEmitted
    >
  ): ActorLogicTransitionResult<
    MachineSnapshot<
      TContext,
      TEvent,
      TChildren,
      TStateValue,
      TTag,
      TOutput,
      TMeta,
      TConfig
    >,
    ExecutableActionObjectFromLogic<this>
  > {
    const usesInertScope = !actorScope;
    const resolvedActorScope = (actorScope ??
      createInertActorScope(this)) as NonNullable<typeof actorScope>;
    const initEvent = createInitEvent(input) as unknown as TEvent; // TODO: fix;
    const internalQueue: AnyEventObject[] = [];
    const preInitialState = this._getPreInitialState(
      resolvedActorScope,
      initEvent
    );
    const contextSpawnEffects = Object.values(preInitialState.children)
      .filter(Boolean)
      .map((actor) => createSpawnEffect(actor as AnyActor));
    let nextState: AnyMachineSnapshot;
    let initialActions: ReadonlyArray<ExecutableActionObject> = [];
    let microsteps: ReadonlyArray<
      readonly [unknown, ReadonlyArray<ExecutableActionObject>]
    > = [];
    let macroState: AnyMachineSnapshot;

    try {
      [nextState, initialActions] = initialMicrostep(
        this.root,
        preInitialState,
        resolvedActorScope,
        initEvent,
        internalQueue
      );

      ({ snapshot: macroState, microsteps } = macrostep(
        nextState,
        initEvent as AnyEventObject,
        resolvedActorScope,
        internalQueue,
        [
          [nextState, [...contextSpawnEffects, ...initialActions]] as [
            AnyMachineSnapshot,
            ExecutableActionObject[]
          ]
        ]
      ));
    } catch (err) {
      if (!this.root.config.onError) {
        throw err;
      }
      const errorEvent = createErrorPlatformEvent('execution', err);
      const errorMacrostep = macrostep(
        preInitialState,
        errorEvent,
        resolvedActorScope,
        [],
        [
          [preInitialState, contextSpawnEffects] as [
            AnyMachineSnapshot,
            ExecutableActionObject[]
          ]
        ]
      );
      macroState = errorMacrostep.snapshot;
      microsteps = errorMacrostep.microsteps;
      initialActions = [];
    }

    if (usesInertScope) {
      setInertActorScopeSnapshot(resolvedActorScope, macroState, false);
    }
    const returnedSnapshot = usesInertScope
      ? attachSnapshotActorRef(this, resolvedActorScope, macroState)
      : this._attachPureActorRef(macroState, resolvedActorScope);
    return [
      returnedSnapshot as SnapshotFrom<this>,
      this._collectEffects(microsteps)
    ];
  }

  public start(
    snapshot?: MachineSnapshot<
      TContext,
      TEvent,
      TChildren,
      TStateValue,
      TTag,
      TOutput,
      TMeta,
      TConfig
    >
  ): void {
    // Start rehydrated children that were active when persisted. Freshly
    // invoked/spawned children are NOT started here — they start via deferred
    // `@xstate.start` actions so sync start errors route to `onError`.
    if (!snapshot?.children) {
      return;
    }
    for (const child of Object.values(
      snapshot.children as unknown as Record<string, AnyActor>
    )) {
      if (
        (child as any)._rehydrated &&
        (child as any).getSnapshot?.().status === 'active'
      ) {
        (child as any).start();
      }
    }
  }

  public getStateNodeById(stateId: string): StateNode<TContext, TEvent> {
    const fullPath = toStatePath(stateId);
    const relativePath = fullPath.slice(1);
    const resolvedStateId = isStateId(fullPath[0])
      ? fullPath[0].slice(STATE_IDENTIFIER.length)
      : fullPath[0];

    const stateNode = this.idMap.get(resolvedStateId);
    if (!stateNode) {
      throw new Error(
        `Child state node '#${resolvedStateId}' does not exist on machine '${this.id}'`
      );
    }
    return getStateNodeByPath(stateNode, relativePath) as StateNode<
      TContext,
      TEvent
    >;
  }

  public getPersistedSnapshot(
    snapshot: MachineSnapshot<
      TContext,
      TEvent,
      TChildren,
      TStateValue,
      TTag,
      TOutput,
      TMeta,
      TConfig
    >,
    options?: unknown
  ) {
    return getPersistedSnapshot(snapshot, options);
  }

  /**
   * The original JSON definition this machine was created from (set by
   * `createMachineFromConfig`), if any. Used by `serializeMachine` for lossless
   * round-trips.
   *
   * @internal
   */
  public _json?: Record<string, unknown>;

  public restoreSnapshot(
    snapshot: Snapshot<unknown>,
    actorScope?: ActorScope<
      MachineSnapshot<
        TContext,
        TEvent,
        TChildren,
        TStateValue,
        TTag,
        TOutput,
        TMeta,
        TConfig
      >,
      TEvent,
      AnyActorSystem,
      TEmitted
    >
  ): MachineSnapshot<
    TContext,
    TEvent,
    TChildren,
    TStateValue,
    TTag,
    TOutput,
    TMeta,
    TConfig
  > {
    const usesInertScope = !actorScope;
    const resolvedActorScope = (actorScope ??
      createInertActorScope(this)) as NonNullable<typeof actorScope>;
    const persistedVersion: string | undefined = (snapshot as any).version;
    if (persistedVersion !== this.version) {
      const migrate = (this.config as any).migrate;
      if (typeof migrate !== 'function') {
        throw new Error(
          isDevelopment
            ? `Persisted snapshot version '${persistedVersion}' does not match machine version '${this.version}' for machine '${this.id}'. Provide a \`migrate(persistedSnapshot, fromVersion)\` function in the machine config to migrate old snapshots.`
            : `Persisted snapshot version '${persistedVersion}' does not match machine version '${this.version}'.`
        );
      }
      snapshot = migrate(snapshot, persistedVersion);
    }

    const snapshotData = snapshot as any;
    const children: Record<string, AnyActor> = {};
    const snapshotChildren: Record<
      string,
      {
        src: string | AnyActorLogic;
        snapshot: Snapshot<unknown>;
        syncSnapshot?: boolean;
        registryKey?: string;
      }
    > = snapshotData.children;

    for (const actorId of Object.keys(snapshotChildren)) {
      const actorData = snapshotChildren[actorId];
      const childState = actorData.snapshot;
      const src = actorData.src;

      const logic =
        typeof src === 'string' ? resolveReferencedActor(this, src) : src;

      if (!logic) {
        continue;
      }

      const actor = resolvedActorScope.system.createActorRef(logic, {
        id: actorId,
        parent: resolvedActorScope.self,
        syncSnapshot: actorData.syncSnapshot,
        snapshot: childState,
        src,
        registryKey: actorData.registryKey
      });
      // Mark so `start()` knows to start this child (freshly invoked/spawned
      // children are started via deferred `@xstate.start` actions instead).
      (actor as any)._rehydrated = true;

      children[actorId] = actor;
    }

    const timers: Record<string, LogicalTimer> = {};
    const persistedTimers: Record<
      string,
      {
        id: string;
        delay: number;
        type: '@xstate.raise' | '@xstate.sendTo';
        event: EventObject;
        target: string | { type: 'parent' };
      }
    > = snapshotData.timers ?? {};
    for (const [id, timer] of Object.entries(persistedTimers)) {
      const target =
        typeof timer.target === 'string'
          ? timer.target === 'self'
            ? 'self'
            : children[timer.target]
          : resolvedActorScope.self._parent;
      if (!target) {
        const targetDescription =
          typeof timer.target === 'string' ? timer.target : timer.target.type;
        throw new Error(
          `Unable to restore timer '${id}': target actor '${targetDescription}' is unavailable.`
        );
      }
      timers[id] = { ...timer, target };
    }

    const reviveHistoryValue = (
      historyValue: Record<
        string,
        ({ id: string } | StateNode<TContext, TEvent>)[]
      >
    ): HistoryValue => {
      if (!historyValue || typeof historyValue !== 'object') {
        return {};
      }
      const revived: HistoryValue = {};
      for (const key of Object.keys(historyValue)) {
        const arr = historyValue[key];

        for (const item of arr) {
          let resolved: StateNode<TContext, TEvent> | undefined;

          if (item instanceof StateNode) {
            resolved = item;
          } else {
            try {
              resolved = this.root.machine.getStateNodeById(item.id);
            } catch {
              if (isDevelopment) {
                console.warn(`Could not resolve StateNode for id: ${item.id}`);
              }
            }
          }

          if (!resolved) {
            continue;
          }

          revived[key] ??= [];
          revived[key].push(resolved);
        }
      }
      return revived;
    };

    const revivedHistoryValue = reviveHistoryValue(snapshotData.historyValue);
    const nodes = Array.from(
      getAllStateNodes(getStateNodes(this.root, snapshotData.value))
    );

    const { version: _persistedSnapshotVersion, ...persistedRest } =
      snapshot as any;
    const restoredSnapshot = createMachineSnapshot(
      {
        ...persistedRest,
        children,
        timers,
        _nodes: nodes,
        value: snapshotData.value,
        historyValue: revivedHistoryValue,
        _stateInputs: snapshotData.stateInputs ?? {}
      },
      this,
      resolvedActorScope.self
    ) as MachineSnapshot<
      TContext,
      TEvent,
      TChildren,
      TStateValue,
      TTag,
      TOutput,
      TMeta,
      TConfig
    >;

    const seen = new WeakSet<Record<string, unknown>>();

    function reviveContext(contextPart: Record<string, unknown>) {
      if (seen.has(contextPart)) {
        return;
      }
      seen.add(contextPart);
      for (const key of Object.keys(contextPart)) {
        const value: unknown = contextPart[key];

        if (value && typeof value === 'object') {
          if ('xstate$$type' in value && value.xstate$$type === $$ACTOR_TYPE) {
            contextPart[key] = children[(value as any).id];
            continue;
          }
          reviveContext(value as typeof contextPart);
        }
      }
    }

    reviveContext(restoredSnapshot.context);

    if (usesInertScope) {
      setInertActorScopeSnapshot(resolvedActorScope, restoredSnapshot, false);
      return attachSnapshotActorRef(this, resolvedActorScope, restoredSnapshot);
    }

    return this._attachPureActorRef(restoredSnapshot, resolvedActorScope);
  }
}
