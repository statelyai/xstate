import isDevelopment from '#is-development';
import { assign } from './actions.ts';
import { STATE_DELIMITER } from './constants.ts';
import { $$ACTOR_TYPE, createActor } from './createActor.ts';
import { createInitEvent } from './eventUtils.ts';
import {
  createMachineSnapshot,
  getPersistedSnapshot,
  MachineSnapshot
} from './State.ts';
import { StateNode } from './StateNode.ts';
import {
  getAllStateNodes,
  getInitialStateNodes,
  getStateNodeByPath,
  getStateNodes,
  isInFinalState,
  isStateId,
  macrostep,
  microstep,
  resolveActionsAndContext,
  resolveStateValue,
  transitionNode
} from './stateUtils.ts';
import { AnyActorSystem } from './system.ts';
import { ResolveTypegenMeta, TypegenDisabled } from './typegenTypes.ts';
import type {
  ActorLogic,
  ActorScope,
  AnyActorLogic,
  AnyActorRef,
  AnyActorScope,
  AnyEventObject,
  Equals,
  EventDescriptor,
  EventObject,
  HistoryValue,
  InternalMachineImplementations,
  MachineConfig,
  MachineContext,
  MachineImplementationsSimplified,
  NoInfer,
  ParameterizedObject,
  ProvidedActor,
  Snapshot,
  SnapshotFrom,
  StateMachineDefinition,
  StateValue,
  TODO,
  TransitionDefinition
} from './types.ts';
import { resolveReferencedActor } from './utils.ts';

export const STATE_IDENTIFIER = '#';
export const WILDCARD = '*';

export class StateMachine<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TChildren extends Record<string, AnyActorRef | undefined>,
  TActor extends ProvidedActor,
  TAction extends ParameterizedObject,
  TGuard extends ParameterizedObject,
  TDelay extends string,
  TStateValue extends StateValue,
  TTag extends string,
  TInput,
  TOutput,
  TConfig,
  TResolvedTypesMeta = ResolveTypegenMeta<
    TypegenDisabled,
    NoInfer<TEvent>,
    TActor,
    TAction,
    TGuard,
    TDelay,
    TTag
  >
> implements
    ActorLogic<
      MachineSnapshot<TContext, TEvent, TChildren, TStateValue, TTag, TOutput>,
      TEvent,
      TInput,
      AnyActorSystem
    >
{
  /**
   * The machine's own version.
   */
  public version?: string;

  public implementations: MachineImplementationsSimplified<TContext, TEvent>;

  public __xstatenode: true = true;

  public idMap: Map<string, StateNode<TContext, TEvent>> = new Map();

  public root: StateNode<TContext, TEvent>;

  public id: string;

  public states: StateNode<TContext, TEvent>['states'];
  public events: Array<EventDescriptor<TEvent>>;

  constructor(
    /**
     * The raw config used to create the machine.
     */
    public config: MachineConfig<
      TContext,
      TEvent,
      any,
      any,
      any,
      any,
      any,
      any,
      TOutput,
      any
    >,
    implementations?: MachineImplementationsSimplified<TContext, TEvent>
  ) {
    this.id = config.id || '(machine)';
    this.implementations = {
      actors: implementations?.actors ?? {},
      actions: implementations?.actions ?? {},
      delays: implementations?.delays ?? {},
      guards: implementations?.guards ?? {}
    };
    this.version = this.config.version;

    this.transition = this.transition.bind(this);
    this.getInitialSnapshot = this.getInitialSnapshot.bind(this);
    this.getPersistedSnapshot = this.getPersistedSnapshot.bind(this);
    this.restoreSnapshot = this.restoreSnapshot.bind(this);
    this.start = this.start.bind(this);

    this.root = new StateNode(config, {
      _key: this.id,
      _machine: this as any
    });

    this.root._initialize();

    this.states = this.root.states; // TODO: remove!
    this.events = this.root.events;

    if (
      isDevelopment &&
      !this.root.output &&
      Object.values(this.states).some(
        (state) => state.type === 'final' && !!state.output
      )
    ) {
      console.warn(
        'Missing `machine.output` declaration (top-level final state with output detected)'
      );
    }
  }

  /**
   * Clones this state machine with the provided implementations
   * and merges the `context` (if provided).
   *
   * @param implementations Options (`actions`, `guards`, `actors`, `delays`, `context`)
   *  to recursively merge with the existing options.
   *
   * @returns A new `StateMachine` instance with the provided implementations.
   */
  public provide(
    implementations: InternalMachineImplementations<
      TContext,
      TResolvedTypesMeta,
      true
    >
  ): StateMachine<
    TContext,
    TEvent,
    TChildren,
    TActor,
    TAction,
    TGuard,
    TDelay,
    TStateValue,
    TTag,
    TInput,
    TOutput,
    TResolvedTypesMeta
  > {
    const { actions, guards, actors, delays } = this.implementations;

    return new StateMachine(this.config, {
      actions: { ...actions, ...implementations.actions },
      guards: { ...guards, ...implementations.guards },
      actors: { ...actors, ...implementations.actors },
      delays: { ...delays, ...implementations.delays }
    });
  }

  public resolveState(
    config: {
      value: StateValue;
      context?: TContext;
      historyValue?: HistoryValue<TContext, TEvent>;
      status?: 'active' | 'done' | 'error' | 'stopped';
      output?: TOutput;
      error?: unknown;
    } & (Equals<TContext, MachineContext> extends false
      ? { context: unknown }
      : {})
  ): MachineSnapshot<TContext, TEvent, TChildren, TStateValue, TTag, TOutput> {
    const resolvedStateValue = resolveStateValue(this.root, config.value);
    const nodeSet = getAllStateNodes(
      getStateNodes(this.root, resolvedStateValue)
    );

    return createMachineSnapshot(
      {
        _nodes: [...nodeSet],
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
      TOutput
    >;
  }

  /**
   * Determines the next snapshot given the current `snapshot` and received `event`.
   * Calculates a full macrostep from all microsteps.
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
      TOutput
    >,
    event: TEvent,
    actorScope: ActorScope<typeof snapshot, TEvent>
  ): MachineSnapshot<TContext, TEvent, TChildren, TStateValue, TTag, TOutput> {
    return macrostep(snapshot, event, actorScope).snapshot as typeof snapshot;
  }

  /**
   * Determines the next state given the current `state` and `event`.
   * Calculates a microstep.
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
      TOutput
    >,
    event: TEvent,
    actorScope: AnyActorScope
  ): Array<
    MachineSnapshot<TContext, TEvent, TChildren, TStateValue, TTag, TOutput>
  > {
    return macrostep(snapshot, event, actorScope)
      .microstates as (typeof snapshot)[];
  }

  public getTransitionData(
    snapshot: MachineSnapshot<
      TContext,
      TEvent,
      TChildren,
      TStateValue,
      TTag,
      TOutput
    >,
    event: TEvent
  ): Array<TransitionDefinition<TContext, TEvent>> {
    return transitionNode(this.root, snapshot.value, snapshot, event) || [];
  }

  /**
   * The initial state _before_ evaluating any microsteps.
   * This "pre-initial" state is provided to initial actions executed in the initial state.
   */
  private getPreInitialState(
    actorScope: AnyActorScope,
    initEvent: any,
    internalQueue: AnyEventObject[]
  ): MachineSnapshot<TContext, TEvent, TChildren, TStateValue, TTag, TOutput> {
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
      const assignment = ({ spawn, event, self }: any) =>
        context({ spawn, input: event.input, self });
      return resolveActionsAndContext(
        preInitial,
        initEvent,
        actorScope,
        [assign(assignment)],
        internalQueue
      ) as SnapshotFrom<this>;
    }

    return preInitial as SnapshotFrom<this>;
  }

  /**
   * Returns the initial `State` instance, with reference to `self` as an `ActorRef`.
   */
  public getInitialSnapshot(
    actorScope: ActorScope<
      MachineSnapshot<TContext, TEvent, TChildren, TStateValue, TTag, TOutput>,
      TEvent
    >,
    input?: TInput
  ): MachineSnapshot<TContext, TEvent, TChildren, TStateValue, TTag, TOutput> {
    const initEvent = createInitEvent(input) as unknown as TEvent; // TODO: fix;
    const internalQueue: AnyEventObject[] = [];
    const preInitialState = this.getPreInitialState(
      actorScope,
      initEvent,
      internalQueue
    );
    const nextState = microstep(
      [
        {
          target: [...getInitialStateNodes(this.root)],
          source: this.root,
          reenter: true,
          actions: [],
          eventType: null as any,
          toJSON: null as any // TODO: fix
        }
      ],
      preInitialState,
      actorScope,
      initEvent,
      true,
      internalQueue
    );

    const { snapshot: macroState } = macrostep(
      nextState,
      initEvent as AnyEventObject,
      actorScope,
      internalQueue
    );

    return macroState as SnapshotFrom<this>;
  }

  public start(
    snapshot: MachineSnapshot<
      TContext,
      TEvent,
      TChildren,
      TStateValue,
      TTag,
      TOutput
    >
  ): void {
    Object.values(snapshot.children as Record<string, AnyActorRef>).forEach(
      (child: any) => {
        if (child.getSnapshot().status === 'active') {
          child.start();
        }
      }
    );
  }

  public getStateNodeById(stateId: string): StateNode<TContext, TEvent> {
    const fullPath = stateId.split(STATE_DELIMITER);
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
    return getStateNodeByPath(stateNode, relativePath);
  }

  public get definition(): StateMachineDefinition<TContext, TEvent> {
    return this.root.definition;
  }

  public toJSON() {
    return this.definition;
  }

  public getPersistedSnapshot(
    snapshot: MachineSnapshot<
      TContext,
      TEvent,
      TChildren,
      TStateValue,
      TTag,
      TOutput
    >,
    options?: unknown
  ) {
    return getPersistedSnapshot(snapshot, options);
  }

  public restoreSnapshot(
    snapshot: Snapshot<unknown>,
    _actorScope: ActorScope<
      MachineSnapshot<TContext, TEvent, TChildren, TStateValue, TTag, TOutput>,
      TEvent
    >
  ): MachineSnapshot<TContext, TEvent, TChildren, TStateValue, TTag, TOutput> {
    const children: Record<string, AnyActorRef> = {};
    const snapshotChildren: Record<
      string,
      {
        src: string | AnyActorLogic;
        snapshot: Snapshot<unknown>;
        syncSnapshot?: boolean;
        systemId?: string;
      }
    > = (snapshot as any).children;

    Object.keys(snapshotChildren).forEach((actorId) => {
      const actorData =
        snapshotChildren[actorId as keyof typeof snapshotChildren];
      const childState = actorData.snapshot;
      const src = actorData.src;

      const logic =
        typeof src === 'string' ? resolveReferencedActor(this, src) : src;

      if (!logic) {
        return;
      }

      const actorRef = createActor(logic, {
        id: actorId,
        parent: _actorScope?.self,
        syncSnapshot: actorData.syncSnapshot,
        snapshot: childState,
        src,
        systemId: actorData.systemId
      });

      children[actorId] = actorRef;
    });

    const restoredSnapshot = createMachineSnapshot(
      {
        ...(snapshot as any),
        children,
        _nodes: Array.from(
          getAllStateNodes(getStateNodes(this.root, (snapshot as any).value))
        )
      },
      this
    ) as MachineSnapshot<
      TContext,
      TEvent,
      TChildren,
      TStateValue,
      TTag,
      TOutput
    >;

    let seen = new Set();

    function reviveContext(
      contextPart: Record<string, unknown>,
      children: Record<string, AnyActorRef>
    ) {
      if (seen.has(contextPart)) {
        return;
      }
      seen.add(contextPart);
      for (let key in contextPart) {
        const value: unknown = contextPart[key];

        if (value && typeof value === 'object') {
          if ('xstate$$type' in value && value.xstate$$type === $$ACTOR_TYPE) {
            contextPart[key] = children[(value as any).id];
            continue;
          }
          reviveContext(value as typeof contextPart, children);
        }
      }
    }

    reviveContext(restoredSnapshot.context, children);

    return restoredSnapshot;
  }

  /** @deprecated an internal property that was acting as a "phantom" type, it's not used by anything right now but it's kept around for compatibility reasons */
  __TResolvedTypesMeta!: TResolvedTypesMeta;
}
