import isDevelopment from '#is-development';
import { createActor } from './createActor.ts';
import { createErrorPlatformEvent, createInitEvent } from './eventUtils.ts';
import { STATE_DELIMITER, XSTATE_TIMER } from './constants.ts';

import { createSpawner } from './spawn.ts';
import {
  attachSnapshotActorRef,
  createInertActorScope,
  isInertActorScope,
  setInertActorScopeSnapshot
} from './inertActorScope.ts';
import { withActorSelf } from './actorScope.ts';
import {
  createMachineSnapshot,
  cloneMachineSnapshot,
  freezeContext,
  getPersistedSnapshot,
  MachineSnapshot
} from './State.ts';
import { setSnapshotActorRef } from './snapshotActorRef.ts';
import { StateNode } from './StateNode.ts';
import {
  formatRouteTransitions,
  getAllStateNodes,
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
  createDeadLetterEffect,
  createSpawnEffect,
  createStartEffect,
  detachedScopes,
  resolveActionsWithContext,
  mergeActorIdCounters,
  takeSpawnAllocationCounters
} from './transitionActions.ts';
import { AnyActorSystem, type DeadLetterDetail } from './system.ts';
import type {
  ActorLogic,
  ActorLogicTransitionResult,
  ActorScope,
  AnyActor,
  AnyActorLogic,
  AnyActorRef,
  AnyActorScope,
  AnyEventObject,
  AnyStateMachine,
  AnyMachineSnapshot,
  AnyTransitionDefinition,
  EventDescriptor,
  EmittedFrom,
  EventObject,
  EventFromLogic,
  ExecutableEffect,
  ExecutableEffectFrom,
  HistoryValue,
  InputFrom,
  MachineContext,
  MetaObject,
  OutputFrom,
  SnapshotFrom,
  StateValue,
  StateSchema,
  SnapshotStatus,
  AnyStateNode
} from './types.ts';
import type { Equals, IsAny } from './typeUtils.ts';
import {
  AnyMachineSchemas,
  DelaySourceMap,
  GuardSourceMap,
  Sources,
  Next_MachineConfig,
  MachineOptions
} from './types.v6.ts';
import {
  describeMachine,
  assertUnreservedSourceName,
  matchesEventDescriptor,
  toStatePath
} from './utils.ts';
import { assertValid } from './validation.ts';
import type { ActorLogicValidator } from './validation.types.ts';

const STATE_IDENTIFIER = '#';

let emptyCanActor: AnyActor | undefined;
let emptyCanActorScope: AnyActorScope | undefined;

function getEmptyCanActor(): AnyActor {
  // A minimal inert actor used purely as the `self`/`parent` argument when
  // dry-running transitions for `snapshot.can(...)`. Intentionally not built
  // on `createStepLogic` so `can()` does not pull that machinery into bundles.
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
  detachedScopes.add(emptyCanActorScope);
  return emptyCanActorScope;
}

export type CompatibleProvidedActorSource<
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

// A required override replaces its source; an optional override may leave
// the original source in place. Keep both types in that case.
type ProvidedSourceMap<TDeclared, TProvided> = {
  [K in keyof TDeclared]: K extends keyof TProvided
    ? {} extends Pick<TProvided, K>
      ? TDeclared[K] | Exclude<TProvided[K], undefined>
      : Exclude<TProvided[K], undefined>
    : TDeclared[K];
};

// The action as the machine declared it. A provided action keeps its own type,
// so integrations can infer from what it returns, and records the declared one,
// so that the next `provide(...)` is checked against the same contract.
type DeclaredAction<T> = T extends {
  readonly '~declaredAction'?: infer TDeclared;
}
  ? unknown extends TDeclared
    ? T
    : Exclude<TDeclared, undefined>
  : T;

type ProvidedActionSourceMap<TDeclared, TProvided> = {
  [K in keyof TDeclared]: K extends keyof TProvided
    ? ({} extends Pick<TProvided, K>
        ? TDeclared[K] | Exclude<TProvided[K], undefined>
        : Exclude<TProvided[K], undefined>) & {
        readonly '~declaredAction'?: DeclaredAction<TDeclared[K]>;
      }
    : TDeclared[K];
};

// Positional arguments must match the declared action. An action declared to
// return nothing (or a result that admits `void`, as an action only declared
// in `schemas.actions` does) is an effect: the implementation may return
// integration-specific values, such as an Effect. Any other declared result,
// such as a context patch, can be returned from a transition, which applies
// it, so the implementation must return a compatible one.
export type ProvidedActionContracts<T> = {
  [K in keyof T]: DeclaredAction<T[K]> extends (
    ...args: infer TArgs
  ) => infer TResult
    ? (...args: TArgs) => ProvidedActionResult<TResult>
    : never;
};

// `Extract` keeps the result within `Sources['actions']`, which declared
// actions already satisfy.
type ProvidedActionResult<TResult> = void extends TResult
  ? void
  : Extract<TResult, ReturnType<Sources['actions'][string]>>;

export { InvalidSnapshotError } from './persistedSnapshotValidation.ts';

/** @public */
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
  TDelayMap extends Sources['delays'],
  TInternalEvent extends EventObject = never,
  TTransitionMeta extends MetaObject = TMeta
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
  /**
   * Type-only marker for the actor's internal event protocol. `actor.send` and
   * `actor.trigger` read it to drop internal events from the public protocol,
   * so it must survive `stripInternal` into the published declarations. Not
   * `declare` (the build's babel pipeline rejects declare class fields); the
   * one `undefined` property this emits per machine instance is inert.
   */
  readonly _internalEventType!: TInternalEvent;
  /** Type-only marker for transition metadata. Never assigned at runtime. */
  readonly _transitionMetaType!: TTransitionMeta;
  /**
   * Type-only marker for the declared input type. `getInitialSnapshot` takes
   * input optionally, so inferring input from it always adds `undefined`;
   * `InputFrom` reads this carrier instead. Method-shaped so it stays
   * bivariant like `getInitialSnapshot`. Never assigned at runtime.
   */
  readonly _inputType!: { carry(input: TInput): void }['carry'];

  /**
   * Type-level carriers for the machine's source maps and state schema. Type
   * helpers in integration packages read these to walk a machine's declared
   * actions, actors and invoked sources. They are never assigned at runtime.
   */
  readonly _actionMap!: TActionMap;
  readonly _actorMap!: TActorMap;
  readonly _stateSchema!: TConfig;

  /** The machine's own version. */
  public version: TConfig extends { version: infer TVersion extends string }
    ? TVersion
    : undefined;

  public schemas:
    | (TConfig extends { schemas: infer TSchemas extends AnyMachineSchemas }
        ? TSchemas
        : AnyMachineSchemas)
    | undefined;

  public sources: Sources;

  /** Runtime options for machine execution. */
  public options: MachineOptions;

  /** @internal */
  public idMap: Map<string, AnyStateNode> = new Map();

  public root: StateNode<TContext, TEvent, TMeta, TTransitionMeta>;

  /**
   * The machine's `id`, or the empty string when the config declares none.
   * The root state node has this id; a machine without one has no `#id` root.
   */
  public id: TConfig extends { id: infer TId extends string } ? TId : '';

  public states: StateNode<TContext, TEvent, TMeta, TTransitionMeta>['states'];
  public events: Array<EventDescriptor<TEvent>>;
  public internalEventDescriptors: ReadonlyArray<string>;
  /** @internal Skips eventless-selection scans for machines without `always`. */
  public _hasEventlessTransitions: boolean;

  /**
   * Adapter hooks for actor-local transition evaluation state. Used by
   * `@xstate/scxml`; not part of the stable API.
   *
   * @experimental
   */
  public _microstepHooks?: AnyStateMachine['_microstepHooks'];

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
      any,
      any,
      any // TEmitted
    > & {
      schemas?: AnyMachineSchemas;
    },
    sources?: Sources,
    public validator?: ActorLogicValidator
  ) {
    if (config.version !== undefined && !config.id) {
      // Persisted snapshots record `{ id, version }`; a version needs an id.
      throw new Error(
        `Machine with version '${config.version}' must declare an id.`
      );
    }
    this.id = (config.id ?? '') as typeof this.id;
    this.sources = {
      actors: config.actors ?? {},
      actions: config.actions ?? {},
      delays: (config.delays ?? {}) as Sources['delays'],
      guards: config.guards ?? {},
      ...sources
    };
    if (isDevelopment) {
      for (const kind of ['actions', 'guards', 'actors', 'delays'] as const) {
        for (const key of Object.keys(this.sources[kind])) {
          assertUnreservedSourceName(kind, key);
        }
      }
    }
    this.version = this.config.version as typeof this.version;
    this.schemas = this.config.schemas as typeof this.schemas;
    this.internalEventDescriptors = Object.keys(
      this.schemas?.internalEvents ?? {}
    );
    this.options = { ...this.config.options };

    this.transition = this.transition.bind(this);
    this.initialTransition = this.initialTransition.bind(this);
    this.getInitialSnapshot = this.getInitialSnapshot.bind(this);
    this.getPersistedSnapshot = this.getPersistedSnapshot.bind(this);
    this.start = this.start.bind(this);

    this.root = new StateNode<TContext, TEvent, TMeta, TTransitionMeta>(
      config as any,
      {
        _key: this.id,
        _machine: this as any
      }
    );

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
    > = {},
    const TProvidedActionMap extends Partial<
      ProvidedActionContracts<TActionMap>
    > = {}
  >(sources: {
    actions?: TProvidedActionMap &
      Partial<ProvidedActionContracts<TActionMap>> &
      Record<Exclude<keyof TProvidedActionMap, keyof TActionMap>, never>;
    actors?: TProvidedActorMap & ProvidedActors<TActorMap, TProvidedActorMap>;
    // Mapped over the known names (not an index signature) so unknown source
    // names are still rejected, while entries keep typed args/return values.
    guards?: Partial<TGuardMap> & {
      [K in keyof TGuardMap]?: GuardSourceMap<TContext, TEvent>[string];
    };
    // Delays are widened to `number | fn` per entry (not Partial<TDelayMap>)
    // so a fixed delay can be swapped for a computed one and vice versa.
    delays?: {
      [K in keyof TDelayMap]?: DelaySourceMap<TContext, TEvent>[string];
    };
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
    ProvidedActionSourceMap<TActionMap, TProvidedActionMap>,
    ProvidedSourceMap<TActorMap, TProvidedActorMap>,
    TGuardMap,
    TDelayMap,
    TInternalEvent,
    TTransitionMeta
  > {
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
    ) as unknown as StateMachine<
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
      ProvidedActionSourceMap<TActionMap, TProvidedActionMap>,
      ProvidedSourceMap<TActorMap, TProvidedActorMap>,
      TGuardMap,
      TDelayMap,
      TInternalEvent,
      TTransitionMeta
    >;
    // Providing sources does not change the serializable definition.
    provided._json = this._json;
    provided.internalEventDescriptors = this.internalEventDescriptors;
    provided._microstepHooks = this._microstepHooks;
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
    ExecutableEffectFrom<this>
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
    if (this.validator) {
      const sourceRef = actorScope && (actorScope.self as any)._lastSourceRef;
      const eventOrigin = sourceRef ? 'actor' : 'external';
      const error = this.validator.check({
        kind: 'event',
        logic: this,
        event,
        eventOrigin
      });
      if (error) {
        // Boundary fault: an invalid event arriving from outside the machine
        // is rejected (never delivered), not routed to the error channel. The
        // snapshot is returned unchanged; the rejection is represented as an
        // effect so hosts and the actor runtime can report it.
        return [
          snapshot,
          [
            createDeadLetterEffect(
              resolvedActorScope,
              sourceRef,
              event,
              'invalidEvent',
              {
                issues: (error as { issues?: DeadLetterDetail['issues'] })
                  .issues,
                error
              }
            ) as ExecutableEffectFrom<this>
          ]
        ];
      }
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
      readonly [unknown, ReadonlyArray<ExecutableEffect>, ...unknown[]]
    >
  ): ExecutableEffectFrom<this>[] {
    return microsteps.flatMap(
      ([, actions]) => actions
    ) as ExecutableEffectFrom<this>[];
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

    const rootInput = snapshot._stateInputs[this.root.id];
    return cloneMachineSnapshot(snapshot, {
      ...(context !== snapshot.context ? { context } : {}),
      ...(stateChanged
        ? {
            _nodes: [this.root, targetNode],
            // The source state exited, so only the root input remains.
            _stateInputs: rootInput ? { [this.root.id]: rootInput } : {}
          }
        : {})
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
    this._microstepHooks?.begin(actorScope.self);
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
    if (snapshot.status !== 'active') {
      return false;
    }
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
        if (isDevelopment) {
          freezeContext(resolvedContext);
        }
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
    ExecutableEffectFrom<this>
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
    const finalizeInitialResult = (
      macroState: AnyMachineSnapshot,
      microsteps: ReadonlyArray<
        readonly [unknown, ReadonlyArray<ExecutableEffect>, ...unknown[]]
      >
    ): ActorLogicTransitionResult<
      SnapshotFrom<this>,
      ExecutableEffectFrom<this>
    > => {
      if (usesInertScope) {
        setInertActorScopeSnapshot(resolvedActorScope, macroState, false);
      }
      const returnedSnapshot = usesInertScope
        ? attachSnapshotActorRef(resolvedActorScope, macroState)
        : this._attachPureActorRef(macroState, resolvedActorScope, true);
      const effects = this._collectEffects(microsteps);
      // Error snapshots may carry synthetic context (e.g. when the context
      // factory throws); validating them would mask the original error.
      if (this.validator && macroState.status !== 'error') {
        assertValid(this.validator, {
          kind: 'result',
          logic: this,
          snapshot: returnedSnapshot,
          effects
        });
      }
      return [returnedSnapshot as SnapshotFrom<this>, effects];
    };

    let preInitialState: AnyMachineSnapshot;
    try {
      preInitialState = this._getPreInitialState(resolvedActorScope, initEvent);
    } catch (error) {
      // Keep the machine snapshot shape (e.g. `matches`) on error snapshots
      // when initialization (e.g. the context factory) throws.
      const errorSnapshot = cloneMachineSnapshot(
        createMachineSnapshot(
          {
            context:
              typeof this.config.context !== 'function' && this.config.context
                ? this.config.context
                : ({} as TContext),
            _nodes: [this.root],
            children: {},
            status: 'active'
          },
          this
        ),
        { status: 'error', error }
      );
      return finalizeInitialResult(errorSnapshot, []);
    }
    const contextSpawnEffects = Object.values(preInitialState.children)
      .filter(Boolean)
      .map((actor) => createSpawnEffect(actor as AnyActor));

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
            ExecutableEffect[]
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
            ExecutableEffect[]
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
    >,
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
        if (actorScope) {
          actorScope.actionExecutor(createStartEffect(child));
        } else {
          void child.system.startActor(child);
        }
      }
    }
  }

  public getStateNodeById(
    stateId: string
  ): StateNode<TContext, TEvent, TMeta, TTransitionMeta> {
    // `#id` is an exact id lookup: the text after `#` is never split into a
    // path. It names a state's explicit `id` or its implicit id.
    const hasPrefix = isStateId(stateId);
    const id = hasPrefix ? stateId.slice(STATE_IDENTIFIER.length) : stateId;

    if (id === '' && hasPrefix) {
      throw new Error(
        this.id
          ? `State id '#' is empty. Target the root of ${describeMachine(this.id)} with '#${this.id}'.`
          : "State id '#' is empty: the root of a machine without an `id` cannot be referenced by id. Give the machine an `id` to reference its root as '#<id>'."
      );
    }
    const stateNode = this.idMap.get(id);
    if (stateNode) {
      return stateNode as StateNode<TContext, TEvent, TMeta, TTransitionMeta>;
    }
    throw new Error(this._describeUnknownStateId(id));
  }

  /**
   * The error message for an id that matches no state. When a prefix of the
   * id is a state id and the rest resolves beneath it as a relative path,
   * suggests the target's own id.
   */
  private _describeUnknownStateId(id: string): string {
    const message = `No state has id "${id}".`;
    const segments = toStatePath(id);
    for (let i = segments.length - 1; i > 0; i--) {
      let node: AnyStateNode | undefined = this.idMap.get(
        segments.slice(0, i).join(STATE_DELIMITER)
      );
      for (let j = i; node && j < segments.length; j++) {
        node = node.states?.[segments[j]];
      }
      if (node) {
        return node.config.id
          ? `${message} Use "#${node.id}".`
          : `${message} Use "#${node.id}", or give that state an id.`;
      }
    }
    return message;
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
   * `machineFromJSON`), if any. Used by `machineToJSON` for lossless
   * round-trips.
   *
   * @internal
   */
  public _json?: Record<string, unknown>;
}
