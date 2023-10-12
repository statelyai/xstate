import { assign } from './actions.ts';
import { createInitEvent } from './eventUtils.ts';
import { STATE_DELIMITER } from './constants.ts';
import { cloneState, getPersistedState, State } from './State.ts';
import { StateNode } from './StateNode.ts';
import {
  getConfiguration,
  getStateNodeByPath,
  getInitialConfiguration,
  getStateNodes,
  isInFinalState,
  isStateId,
  macrostep,
  microstep,
  resolveActionsAndContext,
  resolveStateValue,
  transitionNode,
  isAtomicStateNode
} from './stateUtils.ts';
import type {
  AreAllImplementationsAssumedToBeProvided,
  MarkAllImplementationsAsProvided,
  ResolveTypegenMeta,
  TypegenDisabled
} from './typegenTypes.ts';
import type {
  ActorContext,
  ActorLogic,
  EventObject,
  InternalMachineImplementations,
  MachineConfig,
  MachineContext,
  MachineImplementationsSimplified,
  MachineTypes,
  NoInfer,
  StateConfig,
  StateMachineDefinition,
  StateValue,
  TransitionDefinition,
  PersistedMachineState,
  ParameterizedObject,
  AnyActorContext,
  AnyEventObject,
  ProvidedActor,
  AnyActorRef,
  Equals,
  TODO,
  SnapshotFrom
} from './types.ts';
import { isErrorActorEvent, resolveReferencedActor } from './utils.ts';
import { createActor } from './interpreter.ts';
import isDevelopment from '#is-development';

export const STATE_IDENTIFIER = '#';
export const WILDCARD = '*';

export type MachineSnapshot<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TActor extends ProvidedActor,
  TTag extends string,
  TOutput,
  TResolvedTypesMeta = TypegenDisabled
> =
  | (State<TContext, TEvent, TActor, TTag, TResolvedTypesMeta> & {
      status: 'active';
      output: undefined;
      error: undefined;
    })
  | (State<TContext, TEvent, TActor, TTag, TResolvedTypesMeta> & {
      status: 'done';
      output: TOutput;
      error: undefined;
    })
  | (State<TContext, TEvent, TActor, TTag, TResolvedTypesMeta> & {
      status: 'error';
      output: undefined;
      error: unknown;
    })
  | (State<TContext, TEvent, TActor, TTag, TResolvedTypesMeta> & {
      status: 'stopped';
      output: undefined;
      error: undefined;
    });

export class StateMachine<
  TContext extends MachineContext,
  TEvent extends EventObject,
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
        TActor,
        TTag,
        TOutput,
        TResolvedTypesMeta
      >,
      TEvent,
      TInput,
      PersistedMachineState<
        TContext,
        TEvent,
        TActor,
        TTag,
        TOutput,
        TResolvedTypesMeta
      >,
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
    this.getPersistedState = this.getPersistedState.bind(this);

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
      TEvent,
      TActor,
      TAction,
      TDelay,
      TResolvedTypesMeta,
      true
    >
  ): StateMachine<
    TContext,
    TEvent,
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

  /**
   * Resolves the given `state` to a new `State` instance relative to this machine.
   *
   * This ensures that `.nextEvents` represent the correct values.
   *
   * @param state The state to resolve
   */
  public resolveState(
    state: State<TContext, TEvent, TActor, TTag, TResolvedTypesMeta>
  ): MachineSnapshot<
    TContext,
    TEvent,
    TActor,
    TTag,
    TOutput,
    TResolvedTypesMeta
  > {
    const configurationSet = getConfiguration(
      getStateNodes(this.root, state.value)
    );
    const configuration = Array.from(configurationSet);
    return this.createState({
      ...(state as any),
      value: resolveStateValue(this.root, state.value),
      configuration,
      status: isInFinalState(configuration) ? 'done' : state.status
    });
  }

  public resolveStateValue(
    stateValue: StateValue,
    ...[context]: Equals<TContext, MachineContext> extends true
      ? []
      : [TContext]
  ): MachineSnapshot<
    TContext,
    TEvent,
    TActor,
    TTag,
    TOutput,
    TResolvedTypesMeta
  > {
    const resolvedStateValue = resolveStateValue(this.root, stateValue);

    return this.resolveState(
      State.from(resolvedStateValue, context, this) as any
    );
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
      TActor,
      TTag,
      TOutput,
      TResolvedTypesMeta
    >,
    event: TEvent,
    actorCtx: ActorContext<typeof state, TEvent>
  ): MachineSnapshot<
    TContext,
    TEvent,
    TActor,
    TTag,
    TOutput,
    TResolvedTypesMeta
  > {
    // TODO: handle error events in a better way
    if (
      isErrorActorEvent(event) &&
      !state.nextEvents.some((nextEvent) => nextEvent === event.type)
    ) {
      return cloneState(state, {
        status: 'error',
        error: event.data
      });
    }

    const { state: nextState } = macrostep(state, event, actorCtx);

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
      TActor,
      TTag,
      TOutput,
      TResolvedTypesMeta
    >,
    event: TEvent,
    actorCtx: AnyActorContext
  ): Array<
    MachineSnapshot<TContext, TEvent, TActor, TTag, TOutput, TResolvedTypesMeta>
  > {
    return macrostep(state, event, actorCtx).microstates as (typeof state)[];
  }

  public getTransitionData(
    state: MachineSnapshot<
      TContext,
      TEvent,
      TActor,
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
    actorCtx: AnyActorContext,
    initEvent: any
  ): MachineSnapshot<
    TContext,
    TEvent,
    TActor,
    TTag,
    TOutput,
    TResolvedTypesMeta
  > {
    const { context } = this.config;

    const preInitial = this.resolveState(
      this.createState({
        value: {}, // TODO: this is computed in state constructor
        context:
          typeof context !== 'function' && context ? context : ({} as TContext),
        meta: undefined,
        configuration: getInitialConfiguration(this.root),
        children: {},
        status: 'active'
      })
    );

    if (typeof context === 'function') {
      const assignment = ({ spawn, event }: any) =>
        context({ spawn, input: event.input });
      return resolveActionsAndContext(preInitial, initEvent, actorCtx, [
        assign(assignment)
      ]) as SnapshotFrom<this>;
    }

    return preInitial;
  }

  /**
   * Returns the initial `State` instance, with reference to `self` as an `ActorRef`.
   */
  public getInitialState(
    actorCtx: ActorContext<
      MachineSnapshot<
        TContext,
        TEvent,
        TActor,
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
    TActor,
    TTag,
    TOutput,
    TResolvedTypesMeta
  > {
    const initEvent = createInitEvent(input) as unknown as TEvent; // TODO: fix;

    const preInitialState = this.getPreInitialState(actorCtx, initEvent);
    const nextState = microstep(
      [
        {
          target: [...preInitialState.configuration].filter(isAtomicStateNode),
          source: this.root,
          reenter: true,
          actions: [],
          eventType: null as any,
          toJSON: null as any // TODO: fix
        }
      ],
      preInitialState,
      actorCtx,
      initEvent,
      true
    );

    const { state: macroState } = macrostep(
      nextState,
      initEvent as AnyEventObject,
      actorCtx
    );

    return macroState as SnapshotFrom<this>;
  }

  public start(
    state: MachineSnapshot<
      TContext,
      TEvent,
      TActor,
      TTag,
      TOutput,
      TResolvedTypesMeta
    >
  ): void {
    Object.values(state.children).forEach((child: any) => {
      if (child.status === 0) {
        child.start?.();
      }
    });
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
      TActor,
      TTag,
      TOutput,
      TResolvedTypesMeta
    >
  ): PersistedMachineState<
    TContext,
    TEvent,
    TActor,
    TTag,
    TOutput,
    TResolvedTypesMeta
  > {
    return getPersistedState(state);
  }

  public createState(
    stateConfig:
      | MachineSnapshot<
          TContext,
          TEvent,
          TActor,
          TTag,
          TOutput,
          TResolvedTypesMeta
        >
      | StateConfig<TContext, TEvent>
  ): MachineSnapshot<
    TContext,
    TEvent,
    TActor,
    TTag,
    TOutput,
    TResolvedTypesMeta
  > {
    return stateConfig instanceof State
      ? (stateConfig as any)
      : new State(stateConfig, this);
  }

  public restoreState(
    snapshot: PersistedMachineState<
      TContext,
      TEvent,
      TActor,
      TTag,
      TOutput,
      TResolvedTypesMeta
    >,
    _actorCtx: ActorContext<
      MachineSnapshot<
        TContext,
        TEvent,
        TActor,
        TTag,
        TOutput,
        TResolvedTypesMeta
      >,
      TEvent
    >
  ): MachineSnapshot<
    TContext,
    TEvent,
    TActor,
    TTag,
    TOutput,
    TResolvedTypesMeta
  > {
    const children: Record<string, AnyActorRef> = {};

    Object.keys(snapshot.children).forEach((actorId) => {
      const actorData =
        snapshot.children[actorId as keyof typeof snapshot.children];
      const childState = actorData.state;
      const src = actorData.src;

      const logic = src
        ? resolveReferencedActor(this.implementations.actors[src])?.src
        : undefined;

      if (!logic) {
        return;
      }

      const actorState = logic.restoreState?.(childState, _actorCtx);

      const actorRef = createActor(logic, {
        id: actorId,
        parent: _actorCtx?.self,
        state: actorState
      });

      children[actorId] = actorRef;
    });

    return this.createState(new State({ ...snapshot, children }, this) as any);
  }

  /**@deprecated an internal property acting as a "phantom" type, not meant to be used at runtime */
  __TContext!: TContext;
  /** @deprecated an internal property acting as a "phantom" type, not meant to be used at runtime */
  __TEvent!: TEvent;
  /** @deprecated an internal property acting as a "phantom" type, not meant to be used at runtime */
  __TActor!: TActor;
  /** @deprecated an internal property acting as a "phantom" type, not meant to be used at runtime */
  __TAction!: TAction;
  /** @deprecated an internal property acting as a "phantom" type, not meant to be used at runtime */
  __TGuard!: TGuard;
  /** @deprecated an internal property acting as a "phantom" type, not meant to be used at runtime */
  __TDelay!: TDelay;
  /** @deprecated an internal property acting as a "phantom" type, not meant to be used at runtime */
  __TTag!: TTag;
  /** @deprecated an internal property acting as a "phantom" type, not meant to be used at runtime */
  __TInput!: TInput;
  /** @deprecated an internal property acting as a "phantom" type, not meant to be used at runtime */
  __TOutput!: TOutput;
  /** @deprecated an internal property acting as a "phantom" type, not meant to be used at runtime */
  __TResolvedTypesMeta!: TResolvedTypesMeta;
}
