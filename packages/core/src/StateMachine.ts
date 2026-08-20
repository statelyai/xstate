import isDevelopment from '#is-development';
import { ACTOR_REF_TYPE, createActor } from './createActor.ts';
import {
  createErrorPlatformEvent,
  createInitEvent,
  createInvokeTimeoutEvent
} from './eventUtils.ts';
import { XSTATE_TIMER } from './constants.ts';
import { parseGeneratedActorId } from './system.ts';
import { createRemoteActorRef } from './remoteActorRef.ts';

import { createSpawner } from './spawn.ts';
import {
  attachSnapshotActorRef,
  createInertActorScope,
  isInertActorScope,
  setInertActorScopeSnapshot
} from './getNextSnapshot.ts';
import { withActorSelf } from './actorScope.ts';
import {
  createMachineSnapshot,
  cloneMachineSnapshot,
  getPersistedSnapshot,
  MachineSnapshot
} from './State.ts';
import { setSnapshotActorRef } from './snapshotActorRef.ts';
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
  transitionNode,
  type TransitionSelectionResults
} from './stateUtils.ts';
import {
  beginSpawnAllocation,
  createSpawnEffect,
  resolveActionsWithContext,
  mergeActorIdCounters,
  takeSpawnAllocationCounters
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
  Sources,
  Next_MachineConfig,
  MachineOptions
} from './types.v6.ts';
import {
  matchesEventDescriptor,
  resolveReferencedActor,
  toStatePath
} from './utils.ts';
import { assertValid } from './validation.ts';
import type { ActorLogicValidator } from './validation.types.ts';
import type { StandardSchemaV1 } from './schema.types.ts';
import type { PersistedMachineSnapshot } from './machineVersion.types.ts';

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

type ProvidedActors<
  TExpectedActorMap extends Sources['actors'],
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
  TActionMap extends Sources['actions'],
  TActorMap extends Sources['actors'],
  TGuardMap extends Sources['guards'],
  TDelayMap extends Sources['delays']
> implements ActorLogic<
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
> {
  /** The machine's own version. */
  public version?: string;

  public schemas: AnyMachineSchemas | undefined;

  /** Standard Schema for snapshots persisted by this machine version. */
  public readonly snapshotSchema: StandardSchemaV1<
    unknown,
    Snapshot<unknown> & PersistedMachineSnapshot & { context: TContext }
  >;

  /** Standard Schema for complete events accepted by this machine version. */
  public readonly eventSchema: StandardSchemaV1<unknown, TEvent>;

  public sources: Sources;

  /** Runtime options for machine execution. */
  public options: MachineOptions;

  /** @internal */
  public idMap: Map<string, AnyStateNode> = new Map();

  public root: StateNode<TContext, TEvent>;

  public id: string;

  public states: StateNode<TContext, TEvent>['states'];
  public events: Array<EventDescriptor<TEvent>>;
  public internalEventDescriptors: ReadonlyArray<string>;
  /** @internal Skips eventless-selection scans for machines without `always`. */
  public _hasEventlessTransitions: boolean;
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
    sources?: Sources,
    public validator?: ActorLogicValidator
  ) {
    this.id = config.id || '(machine)';
    this.sources = {
      actors: config.actors ?? {},
      actions: config.actions ?? {},
      delays: (config.delays ?? {}) as Sources['delays'],
      guards: config.guards ?? {},
      ...sources
    };
    if (isDevelopment) {
      // The `@xstate.` prefix is reserved for built-in serialized action and
      // guard descriptors — user source names must not collide.
      for (const kind of ['actions', 'guards', 'actors', 'delays'] as const) {
        for (const key of Object.keys(this.sources[kind])) {
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
    this.snapshotSchema = {
      '~standard': {
        version: 1,
        vendor: 'xstate',
        validate: async (value) => {
          if (value === null || typeof value !== 'object') {
            return { issues: [{ message: 'Expected a persisted snapshot.' }] };
          }
          const snapshot: Record<string, unknown> = {
            historyValue: {},
            timers: {},
            ...(value as Record<string, unknown>)
          };
          const contextSchema = this.schemas?.context;
          let context = snapshot.context;
          if (contextSchema) {
            const result = await contextSchema['~standard'].validate(context);
            if (result.issues) {
              return {
                issues: [
                  {
                    message: `Invalid context for machine '${this.id}' version '${this.version}': ${result.issues[0]?.message}`
                  }
                ]
              };
            }
            context = result.value;
          }
          for (const key of ['value', 'children'] as const) {
            if (!(key in snapshot)) {
              return {
                issues: [{ message: `Persisted snapshot is missing '${key}'.` }]
              };
            }
          }
          if (
            !['active', 'done', 'error', 'stopped'].includes(
              snapshot.status as string
            )
          ) {
            return {
              issues: [{ message: 'Persisted snapshot has invalid status.' }]
            };
          }
          for (const key of ['children', 'historyValue', 'timers'] as const) {
            if (
              snapshot[key] === null ||
              typeof snapshot[key] !== 'object' ||
              Array.isArray(snapshot[key])
            ) {
              return {
                issues: [
                  { message: `Persisted snapshot has invalid '${key}'.` }
                ]
              };
            }
          }
          try {
            this.resolveState({
              value: snapshot.value as StateValue,
              context
            } as any);
          } catch (error) {
            return {
              issues: [
                {
                  message:
                    error instanceof Error
                      ? error.message
                      : 'Persisted snapshot has invalid state value.'
                }
              ]
            };
          }
          return {
            value: { ...snapshot, context } as Snapshot<unknown> &
              PersistedMachineSnapshot & { context: TContext }
          };
        }
      }
    };
    this.eventSchema = {
      '~standard': {
        version: 1,
        vendor: 'xstate',
        validate: async (value) => {
          if (
            value === null ||
            typeof value !== 'object' ||
            typeof (value as EventObject).type !== 'string'
          ) {
            return { issues: [{ message: 'Expected an event object.' }] };
          }
          const event = value as EventObject;
          const eventSchemas = this.schemas?.events;
          const isFrameworkEvent =
            event.type.startsWith('xstate.') ||
            event.type.startsWith('@xstate.');
          const schema =
            eventSchemas && Object.hasOwn(eventSchemas, event.type)
              ? eventSchemas[event.type]
              : undefined;
          if (eventSchemas && !schema && !isFrameworkEvent) {
            return {
              issues: [
                {
                  message: `Unknown event '${event.type}' for machine '${this.id}' version '${this.version}'.`
                }
              ]
            };
          }
          if (!schema) {
            return { value: event as TEvent };
          }
          const { type, ...payload } = event;
          const result = await schema['~standard'].validate(payload);
          if (result.issues) {
            return result;
          }
          if (result.value === null || typeof result.value !== 'object') {
            return { issues: [{ message: 'Expected an event payload.' }] };
          }
          return { value: { ...result.value, type } as TEvent };
        }
      }
    };
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
    this._hasEventlessTransitions = Array.from(this.idMap.values()).some(
      (stateNode) => !!stateNode.always?.length
    );

    this.states = this.root.states; // TODO: remove!
    this.events = this.root.events;
  }

  /**
   * Clones this state machine with the provided sources.
   *
   * @param sources Options (`actions`, `guards`, `actors`, `delays`) to
   *   recursively merge with the existing options.
   * @returns A new `StateMachine` instance with the provided sources.
   */
  public provide<
    const TProvidedActorMap extends Partial<
      Record<keyof TActorMap & string, AnyActorLogic>
    > = {}
  >(sources: {
    actions?: Partial<TActionMap>;
    actors?: TProvidedActorMap & ProvidedActors<TActorMap, TProvidedActorMap>;
    guards?: Partial<TGuardMap>;
    delays?: Partial<TDelayMap>;
  }): this {
    const { actions, guards, actors, delays } = this.sources;

    const provided = new StateMachine(
      this.config,
      {
        actions: {
          ...actions,
          ...sources.actions
        } as Sources['actions'],
        guards: {
          ...guards,
          ...sources.guards
        } as Sources['guards'],
        actors: {
          ...actors,
          ...sources.actors
        } as Sources['actors'],
        delays: {
          ...delays,
          ...sources.delays
        } as Sources['delays']
      },
      this.validator
    ) as unknown as this;
    // Providing sources does not change the serializable definition.
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
    if (this.validator) {
      assertValid(this.validator, {
        kind: 'event',
        logic: this,
        event,
        eventOrigin:
          actorScope && (actorScope.self as any)._lastSourceRef
            ? 'actor'
            : 'external'
      });
    }
    if (usesInertScope) {
      setInertActorScopeSnapshot(resolvedActorScope, snapshot, false);
    }
    beginSpawnAllocation(resolvedActorScope);
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
          ? attachSnapshotActorRef(resolvedActorScope, fastSnapshot)
          : this._attachPureActorRef(fastSnapshot, resolvedActorScope);
      if (this.validator) {
        assertValid(this.validator, {
          kind: 'result',
          logic: this,
          snapshot: returnedSnapshot,
          effects: []
        });
      }
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
        : attachSnapshotActorRef(resolvedActorScope, nextSnapshot)
      : this._attachPureActorRef(nextSnapshot, resolvedActorScope);
    const effects = this._collectEffects(microsteps);
    if (this.validator) {
      assertValid(this.validator, {
        kind: 'result',
        logic: this,
        snapshot: returnedSnapshot,
        effects
      });
    }
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
      effects
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
    actorScope: AnyActorScope,
    skipInitializingActor = false
  ): TSnapshot {
    if (isInertActorScope(actorScope)) {
      return snapshot;
    }
    if (
      skipInitializingActor &&
      (
        actorScope.self as AnyActor & {
          _actorScope?: AnyActorScope;
          _snapshot?: unknown;
        }
      )._actorScope === actorScope &&
      (actorScope.self as AnyActor & { _snapshot?: unknown })._snapshot ===
        undefined
    ) {
      return snapshot;
    }
    setSnapshotActorRef(snapshot, actorScope.self, actorScope.system);
    return snapshot;
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

    if (
      !isInertActorScope(actorScope) &&
      (actorScope.system._hasInspectionObservers?.() ?? true)
    ) {
      const collectedMicrosteps =
        ((actorScope.self as any)._collectedMicrosteps as any[]) || [];
      collectedMicrosteps.push(selected);
      (actorScope.self as any)._collectedMicrosteps = collectedMicrosteps;
    }

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
    actorScope: AnyActorScope,
    selectionResults?: TransitionSelectionResults
  ): Array<AnyTransitionDefinition> {
    return (
      transitionNode(
        this.root,
        snapshot.value,
        snapshot,
        event,
        actorScope,
        selectionResults
      ) || []
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
    const emptyActorScope = getEmptyCanActorScope();
    const transitionData = this.getTransitionData(
      snapshot as any,
      event,
      emptyActorScope
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
        hasEffect(
          transition,
          snapshot.context,
          event,
          snapshot,
          emptyActorScope
        )
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
      !snapshot.nodes?.some((stateNode) => stateNode.config.onError)
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
      this
    );

    if (typeof context === 'function') {
      const children = {};
      const spawn = createSpawner(actorScope, this.sources.actors, children);
      const resolvedContext = context(
        withActorSelf(
          {
            spawn,
            input: initEvent.input,
            actors: this.sources.actors
          },
          actorScope
        )
      );
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
        // Commit the transaction counters so context-factory allocations
        // persist with the snapshot: a freed id is never handed out again
        // after a restore or in a fresh replay process. (The spawner already
        // registered each child for string-id resolution.)
        const counters = takeSpawnAllocationCounters(actorScope);
        if (counters) {
          nextState._nextActorIds = mergeActorIdCounters(
            nextState._nextActorIds,
            counters
          );
        }
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
    if (this.validator) {
      assertValid(this.validator, {
        kind: 'input',
        logic: this,
        input
      });
    }
    const usesInertScope = !actorScope;
    const resolvedActorScope = (actorScope ??
      createInertActorScope(this)) as NonNullable<typeof actorScope>;
    beginSpawnAllocation(resolvedActorScope);
    const initEvent = createInitEvent(input) as unknown as TEvent; // TODO: fix;
    const internalQueue: AnyEventObject[] = [];
    const preInitialState = this._getPreInitialState(
      resolvedActorScope,
      initEvent
    );
    const contextSpawnEffects = Object.values(preInitialState.children)
      .filter(Boolean)
      .map((actor) => createSpawnEffect(actor as AnyActor));
    const finalizeInitialResult = (
      macroState: AnyMachineSnapshot,
      microsteps: ReadonlyArray<
        readonly [unknown, ReadonlyArray<ExecutableActionObject>]
      >
    ): ActorLogicTransitionResult<
      SnapshotFrom<this>,
      ExecutableActionObjectFromLogic<this>
    > => {
      if (usesInertScope) {
        setInertActorScopeSnapshot(resolvedActorScope, macroState, false);
      }
      const returnedSnapshot = usesInertScope
        ? attachSnapshotActorRef(resolvedActorScope, macroState)
        : this._attachPureActorRef(macroState, resolvedActorScope, true);
      const effects = this._collectEffects(microsteps);
      if (this.validator) {
        assertValid(this.validator, {
          kind: 'result',
          logic: this,
          snapshot: returnedSnapshot,
          effects
        });
      }
      return [returnedSnapshot as SnapshotFrom<this>, effects];
    };

    try {
      const [nextState, initialActions] = initialMicrostep(
        this.root,
        preInitialState,
        resolvedActorScope,
        initEvent,
        internalQueue
      );

      const { snapshot: macroState, microsteps } = macrostep(
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
      );
      return finalizeInitialResult(macroState, microsteps);
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
      return finalizeInitialResult(
        errorMacrostep.snapshot,
        errorMacrostep.microsteps
      );
    }
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
    const children = snapshot.children as unknown as Record<string, AnyActor>;
    for (const childId in children) {
      if (!Object.hasOwn(children, childId)) {
        continue;
      }
      const child = children[childId];
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
    const persistedMachine = (snapshot as any).machine;
    const legacyPersistedVersion: string | undefined = (snapshot as any)
      .version;
    const persistedVersion: string | undefined =
      typeof persistedMachine?.version === 'string'
        ? persistedMachine.version
        : legacyPersistedVersion;
    if (
      legacyPersistedVersion !== undefined &&
      persistedMachine?.version !== undefined &&
      persistedMachine.version !== legacyPersistedVersion
    ) {
      throw new Error(
        `Persisted snapshot version '${legacyPersistedVersion}' conflicts with machine version '${persistedMachine.version}'.`
      );
    }
    if (
      persistedMachine &&
      typeof persistedMachine.id === 'string' &&
      persistedMachine.id !== this.id
    ) {
      throw new Error(
        isDevelopment
          ? `Machine ID mismatch: persisted snapshot was created by machine '${persistedMachine.id}', but machine '${this.id}' was provided.`
          : `Machine ID mismatch: persisted snapshot machine '${persistedMachine.id}' does not match '${this.id}'.`
      );
    }
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
        snapshot?: Snapshot<unknown>;
        address?: string;
        remote?: boolean;
        incarnation?: string;
        syncSnapshot?: boolean;
        registryKey?: string;
      }
    > = snapshotData.children;

    for (const actorId of Object.keys(snapshotChildren)) {
      const actorData = snapshotChildren[actorId];

      if (actorData.remote === true && actorData.address !== undefined) {
        if (typeof actorData.src !== 'string') {
          // Fail loudly instead of fabricating a source key that hosts would
          // route by.
          throw new Error(
            `Unable to restore remote child '${actorId}': a child referenced by address requires a registered source key.`
          );
        }
        // The child's state lives with another runtime; restore a
        // location-transparent handle constructed from its identity alone.
        // The handle keeps its persisted address verbatim: the owning
        // runtime's identity for the child wins over the local parent chain.
        const handle = createRemoteActorRef(resolvedActorScope.system, {
          id: actorId,
          address: actorData.address,
          src: actorData.src,
          parent: resolvedActorScope.self,
          registryKey: actorData.registryKey,
          syncSnapshot: actorData.syncSnapshot,
          incarnation: actorData.incarnation
        });
        if (actorData.registryKey) {
          resolvedActorScope.system._set(actorData.registryKey, handle);
        }
        children[actorId] = handle;
        continue;
      }

      const childState = actorData.snapshot;
      const src = actorData.src;

      const logic =
        typeof src === 'string' ? resolveReferencedActor(this, src) : src;

      if (!logic) {
        const sourceId = typeof src === 'string' ? src : '<unknown>';
        throw new Error(
          `Unable to restore child actor '${actorId}': child source '${sourceId}' is not provided in machine '${this.id}'.`
        );
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
      let event = timer.event;
      if (event.type === 'xstate.timeout.actor') {
        const actorId = (event as AnyEventObject).actorId as string;
        const child = children[actorId];
        if (child) {
          event = createInvokeTimeoutEvent(actorId, child.sessionId);
        }
      }
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
      timers[id] = { ...timer, event, target };
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

    const validateStateValue = (
      stateValue: StateValue,
      node: AnyStateNode,
      path: string[]
    ): void => {
      const missingStateError = (statePath: string[]) =>
        new Error(
          `Persisted snapshot references state '${statePath.join('.')}' which does not exist on machine '${this.id}'.`
        );
      if (typeof stateValue === 'string') {
        if (!node.states[stateValue]) {
          throw missingStateError(path.concat(stateValue));
        }
        return;
      }
      if (!stateValue || typeof stateValue !== 'object') {
        return;
      }
      for (const key of Object.keys(stateValue)) {
        const childNode = node.states[key];
        if (!childNode) {
          throw missingStateError(path.concat(key));
        }
        validateStateValue(stateValue[key]!, childNode, path.concat(key));
      }
    };
    validateStateValue(snapshotData.value, this.root, []);

    const nodes = Array.from(
      getAllStateNodes(getStateNodes(this.root, snapshotData.value))
    );

    const {
      version: _persistedSnapshotVersion,
      // The legacy system-wide counter: superseded by per-snapshot
      // `_nextActorIds` plus the child-id fold below; dropped so old and new
      // snapshots round-trip to the same shape.
      _nextActorId: _legacyNextActorId,
      ...persistedRest
    } = snapshot as any;
    // Fold generated-shaped child ids into the counters as a floor: snapshots
    // persisted before per-actor counters (or hand-crafted ones) still must
    // never reuse a live child's id.
    let restoredCounters: Record<string, number> | undefined =
      persistedRest._nextActorIds;
    for (const childId of Object.keys(snapshotChildren)) {
      const generated = parseGeneratedActorId(childId);
      if (
        generated &&
        (restoredCounters?.[generated.prefix] ?? 0) <= generated.index
      ) {
        restoredCounters = {
          ...restoredCounters,
          [generated.prefix]: generated.index + 1
        };
      }
    }
    const restoredSnapshot = createMachineSnapshot(
      {
        ...persistedRest,
        children,
        timers,
        _nextActorIds: restoredCounters,
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
          if ('xstate$type' in value && value.xstate$type === ACTOR_REF_TYPE) {
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
      return attachSnapshotActorRef(resolvedActorScope, restoredSnapshot);
    }

    return this._attachPureActorRef(restoredSnapshot, resolvedActorScope);
  }
}
