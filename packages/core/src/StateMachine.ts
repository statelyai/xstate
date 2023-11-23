import { assign } from './actions.ts';
import { createInitEvent } from './eventUtils.ts';
import { STATE_DELIMITER } from './constants.ts';
import {
  cloneMachineSnapshot,
  createMachineSnapshot,
  getPersistedState,
  MachineSnapshot
} from './State.ts';
import { StateNode } from './StateNode.ts';
import {
  getAllStateNodes,
  getStateNodeByPath,
  getStateNodes,
  isInFinalState,
  isStateId,
  macrostep,
  microstep,
  resolveActionsAndContext,
  resolveStateValue,
  transitionNode,
  getInitialStateNodes
} from './stateUtils.ts';
import type {
  AreAllImplementationsAssumedToBeProvided,
  MarkAllImplementationsAsProvided,
  ResolveTypegenMeta,
  TypegenDisabled
} from './typegenTypes.ts';
import type {
  ActorScope,
  ActorLogic,
  EventObject,
  InternalMachineImplementations,
  MachineConfig,
  MachineContext,
  MachineImplementationsSimplified,
  MachineTypes,
  NoInfer,
  StateMachineDefinition,
  StateValue,
  TransitionDefinition,
  ParameterizedObject,
  AnyActorScope,
  AnyEventObject,
  ProvidedActor,
  AnyActorRef,
  Equals,
  TODO,
  SnapshotFrom,
  Snapshot,
  AnyActorLogic,
  HistoryValue
} from './types.ts';
import { isErrorActorEvent, resolveReferencedActor } from './utils.ts';
import { $$ACTOR_TYPE, createActor } from './interpreter.ts';
import isDevelopment from '#is-development';

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
  TTag extends string,
  TInput,
  TOutput,
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
      MachineSnapshot<
        TContext,
        TEvent,
        TChildren,
        TTag,
        TOutput,
        TResolvedTypesMeta
      >,
      TEvent,
      TInput,
      TODO
    >
{
  /**
   * The machine's own version.
   */
  public version?: string;

  public implementations: MachineImplementationsSimplified<TContext, TEvent>;

  public types: MachineTypes<
    TContext,
    TEvent,
    TActor,
    TAction,
    TGuard,
    TDelay,
    TTag,
    TInput,
    TOutput,
    TResolvedTypesMeta
  >;

  public __xstatenode: true = true;

  public idMap: Map<string, StateNode<TContext, TEvent>> = new Map();

  public root: StateNode<TContext, TEvent>;

  public id: string;

  public states: StateNode<TContext, TEvent>['states'];
  public events: Array<TEvent['type']>;

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
    this.types = this.config.types ?? ({} as any as this['types']);

    this.transition = this.transition.bind(this);
    this.getInitialState = this.getInitialState.bind(this);
    this.restoreState = this.restoreState.bind(this);
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
    TTag,
    TInput,
    TOutput,
    AreAllImplementationsAssumedToBeProvided<TResolvedTypesMeta> extends false
      ? MarkAllImplementationsAsProvided<TResolvedTypesMeta>
      : TResolvedTypesMeta
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
  ): MachineSnapshot<
    TContext,
    TEvent,
    TChildren,
    TTag,
    TOutput,
    TResolvedTypesMeta
  > {
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
      TTag,
      TOutput,
      TResolvedTypesMeta
    >;
  }

  /**
   * Determines the next state given the current `state` and received `event`.
   * Calculates a full macrostep from all microsteps.
   *
   * @param state The current State instance or state value
   * @param event The received event
   */
  public transition(
    state: MachineSnapshot<
      TContext,
      TEvent,
      TChildren,
      TTag,
      TOutput,
      TResolvedTypesMeta
    >,
    event: TEvent,
    actorScope: ActorScope<typeof state, TEvent>
  ): MachineSnapshot<
    TContext,
    TEvent,
    TChildren,
    TTag,
    TOutput,
    TResolvedTypesMeta
  > {
    // TODO: handle error events in a better way
    if (
      isErrorActorEvent(event) &&
      !state.getNextEvents().some((nextEvent) => nextEvent === event.type)
    ) {
      return cloneMachineSnapshot(state, {
        status: 'error',
        error: event.data
      });
    }

    const { state: nextState } = macrostep(state, event, actorScope);

    return nextState as typeof state;
  }

  /**
   * Determines the next state given the current `state` and `event`.
   * Calculates a microstep.
   *
   * @param state The current state
   * @param event The received event
   */
  public microstep(
    state: MachineSnapshot<
      TContext,
      TEvent,
      TChildren,
      TTag,
      TOutput,
      TResolvedTypesMeta
    >,
    event: TEvent,
    actorScope: AnyActorScope
  ): Array<
    MachineSnapshot<
      TContext,
      TEvent,
      TChildren,
      TTag,
      TOutput,
      TResolvedTypesMeta
    >
  > {
    return macrostep(state, event, actorScope).microstates as (typeof state)[];
  }

  public getTransitionData(
    state: MachineSnapshot<
      TContext,
      TEvent,
      TChildren,
      TTag,
      TOutput,
      TResolvedTypesMeta
    >,
    event: TEvent
  ): Array<TransitionDefinition<TContext, TEvent>> {
    return transitionNode(this.root, state.value, state, event) || [];
  }

  /**
   * The initial state _before_ evaluating any microsteps.
   * This "pre-initial" state is provided to initial actions executed in the initial state.
   */
  private getPreInitialState(
    actorScope: AnyActorScope,
    initEvent: any,
    internalQueue: AnyEventObject[]
  ): MachineSnapshot<
    TContext,
    TEvent,
    TChildren,
    TTag,
    TOutput,
    TResolvedTypesMeta
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
      const assignment = ({ spawn, event }: any) =>
        context({ spawn, input: event.input });
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
  public getInitialState(
    actorScope: ActorScope<
      MachineSnapshot<
        TContext,
        TEvent,
        TChildren,
        TTag,
        TOutput,
        TResolvedTypesMeta
      >,
      TEvent
    >,
    input?: TInput
  ): MachineSnapshot<
    TContext,
    TEvent,
    TChildren,
    TTag,
    TOutput,
    TResolvedTypesMeta
  > {
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

    const { state: macroState } = macrostep(
      nextState,
      initEvent as AnyEventObject,
      actorScope,
      internalQueue
    );

    return macroState as SnapshotFrom<this>;
  }

  public start(
    state: MachineSnapshot<
      TContext,
      TEvent,
      TChildren,
      TTag,
      TOutput,
      TResolvedTypesMeta
    >
  ): void {
    Object.values(state.children as Record<string, AnyActorRef>).forEach(
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

  public getPersistedState(
    state: MachineSnapshot<
      TContext,
      TEvent,
      TChildren,
      TTag,
      TOutput,
      TResolvedTypesMeta
    >,
    options?: unknown
  ) {
    return getPersistedState(state, options);
  }

  public restoreState(
    snapshot: Snapshot<unknown>,
    _actorScope: ActorScope<
      MachineSnapshot<
        TContext,
        TEvent,
        TChildren,
        TTag,
        TOutput,
        TResolvedTypesMeta
      >,
      TEvent
    >
  ): MachineSnapshot<
    TContext,
    TEvent,
    TChildren,
    TTag,
    TOutput,
    TResolvedTypesMeta
  > {
    const children: Record<string, AnyActorRef> = {};
    const snapshotChildren: Record<
      string,
      {
        src: string | AnyActorLogic;
        state: Snapshot<unknown>;
        syncSnapshot?: boolean;
        systemId?: string;
      }
    > = (snapshot as any).children;

    Object.keys(snapshotChildren).forEach((actorId) => {
      const actorData =
        snapshotChildren[actorId as keyof typeof snapshotChildren];
      const childState = actorData.state;
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
        state: childState,
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
      TTag,
      TOutput,
      TResolvedTypesMeta
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

  /** @deprecated an internal property acting as a "phantom" type, not meant to be used at runtime */
  __TResolvedTypesMeta!: TResolvedTypesMeta;
}
