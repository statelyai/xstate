import { MachineSnapshot } from './State.ts';
import type { StateMachine } from './StateMachine.ts';
import { NULL_EVENT, STATE_DELIMITER } from './constants.ts';
import { memo } from './memo.ts';
import {
  BuiltinAction,
  evaluateCandidate,
  formatInitialTransition,
  formatTransition,
  formatTransitions,
  getCandidates,
  getDelayedTransitions
} from './stateUtils.ts';
import type {
  DelayedTransitionDefinition,
  EventObject,
  InitialTransitionDefinition,
  InvokeDefinition,
  MachineContext,
  Mapper,
  StateNodeConfig,
  StateNodeDefinition,
  StateNodesConfig,
  StatesDefinition,
  TransitionDefinition,
  TransitionDefinitionMap,
  TODO,
  UnknownAction,
  ParameterizedObject,
  AnyStateMachine,
  AnyStateNodeConfig,
  ProvidedActor,
  NonReducibleUnknown,
  EventDescriptor,
  Action2,
  AnyActorRef,
  AnyStateNode,
  InitialTransitionConfig,
  AnyEventObject,
  TransitionConfigFunction
} from './types.ts';
import {
  createInvokeId,
  mapValues,
  toArray,
  toTransitionConfigArray
} from './utils.ts';

const EMPTY_OBJECT = {};

const toSerializableAction = (action: UnknownAction) => {
  if (typeof action === 'string') {
    return { type: action };
  }
  if (typeof action === 'function') {
    if ('resolve' in action) {
      return { type: (action as BuiltinAction).type };
    }
    return {
      type: action.name
    };
  }
  return action;
};

interface StateNodeOptions<
  TContext extends MachineContext,
  TEvent extends EventObject
> {
  _key: string;
  _parent?: StateNode<TContext, TEvent>;
  _machine: AnyStateMachine;
}

export class StateNode<
  TContext extends MachineContext = MachineContext,
  TEvent extends EventObject = EventObject
> {
  /**
   * The relative key of the state node, which represents its location in the
   * overall state value.
   */
  public key: string;
  /** The unique ID of the state node. */
  public id: string;
  /**
   * The type of this state node:
   *
   * - `'atomic'` - no child state nodes
   * - `'compound'` - nested child state nodes (XOR)
   * - `'parallel'` - orthogonal nested child state nodes (AND)
   * - `'history'` - history state node
   * - `'final'` - final state node
   */
  public type: 'atomic' | 'compound' | 'parallel' | 'final' | 'history';
  /** The string path from the root machine node to this node. */
  public path: string[];
  /** The child state nodes. */
  public states: StateNodesConfig<TContext, TEvent>;
  /**
   * The type of history on this state node. Can be:
   *
   * - `'shallow'` - recalls only top-level historical state value
   * - `'deep'` - recalls historical state value at all levels
   */
  public history: false | 'shallow' | 'deep';
  /** The action(s) to be executed upon entering the state node. */
  public entry: UnknownAction[];
  public entry2: Action2<any, any, any, any, any, any, any> | undefined;
  /** The action(s) to be executed upon exiting the state node. */
  public exit: UnknownAction[];
  public exit2: Action2<any, any, any, any, any, any, any> | undefined;
  /** The parent state node. */
  public parent?: StateNode<TContext, TEvent>;
  /** The root machine node. */
  public machine: StateMachine<
    TContext,
    TEvent,
    any, // children
    any, // actor
    any, // action
    any, // guard
    any, // delay
    any, // state value
    any, // tag
    any, // input
    any, // output
    any, // emitted
    any, // meta
    any, // state schema
    any, // action map
    any, // actor map
    any, // guard map
    any // delay map
  >;
  /**
   * The meta data associated with this state node, which will be returned in
   * State instances.
   */
  public meta?: any;
  /**
   * The output data sent with the "xstate.done.state._id_" event if this is a
   * final state node.
   */
  public output?:
    | Mapper<MachineContext, EventObject, unknown, EventObject>
    | NonReducibleUnknown;

  /**
   * The order this state node appears. Corresponds to the implicit document
   * order.
   */
  public order: number = -1;

  public description?: string;

  public tags: string[] = [];
  public transitions!: Map<string, TransitionDefinition<TContext, TEvent>[]>;
  public always?: Array<TransitionDefinition<TContext, TEvent>>;

  constructor(
    /** The raw config used to create the machine. */
    public config: StateNodeConfig<
      TContext,
      TEvent,
      TODO, // actors
      TODO, // actions
      TODO, // guards
      TODO, // delays
      TODO, // tags
      TODO, // output
      TODO, // emitted
      TODO // meta
    >,
    options: StateNodeOptions<TContext, TEvent>
  ) {
    this.parent = options._parent;
    this.key = options._key;
    this.machine = options._machine;
    this.path = this.parent ? this.parent.path.concat(this.key) : [];
    this.id =
      this.config.id || [this.machine.id, ...this.path].join(STATE_DELIMITER);
    this.type =
      this.config.type ||
      (this.config.states && Object.keys(this.config.states).length
        ? 'compound'
        : this.config.history
          ? 'history'
          : 'atomic');
    this.description = this.config.description;

    this.order = this.machine.idMap.size;
    this.machine.idMap.set(this.id, this);

    this.states = (
      this.config.states
        ? mapValues(
            this.config.states,
            (stateConfig: AnyStateNodeConfig, key) => {
              const stateNode = new StateNode(stateConfig, {
                _parent: this,
                _key: key,
                _machine: this.machine
              });
              return stateNode;
            }
          )
        : EMPTY_OBJECT
    ) as StateNodesConfig<TContext, TEvent>;

    if (this.type === 'compound' && !this.config.initial) {
      throw new Error(
        `No initial state specified for compound state node "#${
          this.id
        }". Try adding { initial: "${
          Object.keys(this.states)[0]
        }" } to the state config.`
      );
    }

    // History config
    this.history =
      this.config.history === true ? 'shallow' : this.config.history || false;

    if (this.machine.config._special) {
      this.entry2 = this.config.entry;
      // this.config.entry = undefined;
      this.exit2 = this.config.exit;
      // this.config.exit = undefined;
    }

    this.entry = toArray(this.config.entry).slice();
    this.exit = toArray(this.config.exit).slice();
    this.entry2 ??= this.config.entry2;
    this.exit2 ??= this.config.exit2;
    if (this.entry2) {
      // @ts-ignore
      this.entry2._special = true;
    }

    if (this.exit2) {
      // @ts-ignore
      this.exit2._special = true;
    }

    this.meta = this.config.meta;
    this.output =
      this.type === 'final' || !this.parent ? this.config.output : undefined;
    this.tags = toArray(config.tags).slice();
  }

  /** @internal */
  public _initialize() {
    this.transitions = formatTransitions(this);
    if (this.config.always) {
      this.always = toTransitionConfigArray(this.config.always).map((t) =>
        typeof t === 'function' ? t : formatTransition(this, NULL_EVENT, t)
      );
    }

    Object.keys(this.states).forEach((key) => {
      this.states[key]._initialize();
    });
  }

  /** The well-structured state node definition. */
  public get definition(): StateNodeDefinition<TContext, TEvent> {
    return {
      id: this.id,
      key: this.key,
      version: this.machine.version,
      type: this.type,
      initial: this.initial
        ? {
            target: this.initial.target,
            source: this,
            actions: this.initial.actions.map(toSerializableAction),
            eventType: null as any,
            reenter: false
          }
        : undefined,
      history: this.history,
      states: mapValues(this.states, (state: StateNode<TContext, TEvent>) => {
        return state.definition;
      }) as StatesDefinition<TContext, TEvent>,
      on: this.on,
      transitions: [...this.transitions.values()].flat().map((t) => ({
        ...t,
        actions: t.actions.map(toSerializableAction)
      })),
      entry: this.entry.map(toSerializableAction),
      exit: this.exit.map(toSerializableAction),
      meta: this.meta,
      order: this.order || -1,
      output: this.output,
      invoke: this.invoke,
      description: this.description,
      tags: this.tags
    };
  }

  /** @internal */
  public toJSON() {
    return this.definition;
  }

  /** The logic invoked as actors by this state node. */
  public get invoke(): Array<
    InvokeDefinition<
      TContext,
      TEvent,
      ProvidedActor,
      ParameterizedObject,
      ParameterizedObject,
      string,
      TODO, // TEmitted
      TODO // TMeta
    >
  > {
    return memo(this, 'invoke', () =>
      toArray(this.config.invoke).map((invokeConfig, i) => {
        const { src, systemId } = invokeConfig;
        const resolvedId = invokeConfig.id ?? createInvokeId(this.id, i);
        const sourceName =
          typeof src === 'string'
            ? src
            : `xstate.invoke.${createInvokeId(this.id, i)}`;

        return {
          ...invokeConfig,
          src: sourceName,
          logic: typeof src === 'string' ? undefined : src,
          id: resolvedId,
          systemId: systemId
        } as InvokeDefinition<
          TContext,
          TEvent,
          ProvidedActor,
          ParameterizedObject,
          ParameterizedObject,
          string,
          TODO, // TEmitted
          TODO // TMeta
        >;
      })
    );
  }

  /** The mapping of events to transitions. */
  public get on(): TransitionDefinitionMap<TContext, TEvent> {
    return memo(this, 'on', () => {
      const transitions = this.transitions;

      return [...transitions]
        .flatMap(([descriptor, t]) => t.map((t) => [descriptor, t] as const))
        .reduce(
          (map: any, [descriptor, transition]) => {
            map[descriptor] = map[descriptor] || [];
            map[descriptor].push(transition);
            return map;
          },
          {} as TransitionDefinitionMap<TContext, TEvent>
        );
    });
  }

  public get after(): Array<DelayedTransitionDefinition<TContext, TEvent>> {
    return memo(
      this,
      'delayedTransitions',
      () => getDelayedTransitions(this) as any
    );
  }

  public get initial(): InitialTransitionDefinition<TContext, TEvent, TODO> {
    return memo(this, 'initial', () =>
      formatInitialTransition(this, this.config.initial)
    );
  }

  /** @internal */
  public next(
    snapshot: MachineSnapshot<
      TContext,
      TEvent,
      any,
      any,
      any,
      any,
      any, // TMeta
      any // TStateSchema
    >,
    event: TEvent,
    self: AnyActorRef
  ): TransitionDefinition<TContext, TEvent>[] | undefined {
    const eventType = event.type;
    const actions: UnknownAction[] = [];

    let selectedTransition: TransitionDefinition<TContext, TEvent> | undefined;

    const candidates: Array<TransitionDefinition<TContext, TEvent>> = memo(
      this,
      `candidates-${eventType}`,
      () => getCandidates(this, eventType)
    );

    for (const candidate of candidates) {
      const guardPassed = evaluateCandidate(
        candidate,
        event,
        snapshot,
        this,
        self
      );

      if (guardPassed) {
        actions.push(...candidate.actions);
        selectedTransition = candidate;
        break;
      }
    }

    return selectedTransition ? [selectedTransition] : undefined;
  }

  /** All the event types accepted by this state node and its descendants. */
  public get events(): Array<EventDescriptor<TEvent>> {
    return memo(this, 'events', () => {
      const { states } = this;
      const events = new Set(this.ownEvents);

      if (states) {
        for (const stateId of Object.keys(states)) {
          const state = states[stateId];
          if (state.states) {
            for (const event of state.events) {
              events.add(`${event}`);
            }
          }
        }
      }

      return Array.from(events);
    });
  }

  /**
   * All the events that have transitions directly from this state node.
   *
   * Excludes any inert events.
   */
  public get ownEvents(): Array<EventDescriptor<TEvent>> {
    const events = new Set(
      [...this.transitions.keys()].filter((descriptor) => {
        return this.transitions
          .get(descriptor)!
          .some(
            (transition) =>
              transition.target ||
              transition.actions.length ||
              transition.reenter ||
              transition.fn
          );
      })
    );

    return Array.from(events);
  }
}

export function formatTransitions<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  stateNode: AnyStateNode
): Map<string, TransitionDefinition<TContext, TEvent>[]> {
  const transitions = new Map<
    string,
    TransitionDefinition<TContext, AnyEventObject>[]
  >();
  if (stateNode.config.on) {
    for (const descriptor of Object.keys(stateNode.config.on)) {
      if (descriptor === NULL_EVENT) {
        throw new Error(
          'Null events ("") cannot be specified as a transition key. Use `always: { ... }` instead.'
        );
      }
      const transitionsConfig = stateNode.config.on[descriptor];
      transitions.set(
        descriptor,
        toTransitionConfigArray(transitionsConfig).map((t) =>
          typeof t === 'function'
            ? t
            : formatTransition(stateNode, descriptor, t)
        )
      );
    }
  }
  if (stateNode.config.onDone) {
    const descriptor = `xstate.done.state.${stateNode.id}`;
    transitions.set(
      descriptor,
      toTransitionConfigArray(stateNode.config.onDone).map((t) =>
        typeof t === 'function' ? t : formatTransition(stateNode, descriptor, t)
      )
    );
  }
  for (const invokeDef of stateNode.invoke) {
    if (invokeDef.onDone) {
      const descriptor = `xstate.done.actor.${invokeDef.id}`;
      transitions.set(
        descriptor,
        toTransitionConfigArray(invokeDef.onDone).map((t) =>
          typeof t === 'function'
            ? t
            : formatTransition(stateNode, descriptor, t)
        )
      );
    }
    if (invokeDef.onError) {
      const descriptor = `xstate.error.actor.${invokeDef.id}`;
      transitions.set(
        descriptor,
        toTransitionConfigArray(invokeDef.onError).map((t) =>
          typeof t === 'function'
            ? t
            : formatTransition(stateNode, descriptor, t)
        )
      );
    }
    if (invokeDef.onSnapshot) {
      const descriptor = `xstate.snapshot.${invokeDef.id}`;
      transitions.set(
        descriptor,
        toTransitionConfigArray(invokeDef.onSnapshot).map((t) =>
          typeof t === 'function'
            ? t
            : formatTransition(stateNode, descriptor, t)
        )
      );
    }
  }
  for (const delayedTransition of stateNode.after) {
    let existing = transitions.get(delayedTransition.eventType);
    if (!existing) {
      existing = [];
      transitions.set(delayedTransition.eventType, existing);
    }
    existing.push(delayedTransition);
  }
  return transitions as Map<string, TransitionDefinition<TContext, any>[]>;
}

export function formatInitialTransition<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  stateNode: AnyStateNode,
  _target:
    | string
    | undefined
    | InitialTransitionConfig<TContext, TEvent, TODO, TODO, TODO, TODO>
    | TransitionConfigFunction<
        TContext,
        TEvent,
        TEvent,
        TODO,
        TODO,
        TODO,
        TODO,
        TODO
      >
): InitialTransitionDefinition<TContext, TEvent, TODO> {
  if (typeof _target === 'function') {
    return {
      initial: true,
      source: stateNode,
      fn: _target
    };
  }
  const resolvedTarget =
    typeof _target === 'string'
      ? stateNode.states[_target]
      : _target
        ? stateNode.states[_target.target]
        : undefined;
  if (!resolvedTarget && _target) {
    throw new Error(
      `Initial state node "${_target}" not found on parent state node #${stateNode.id}`
    );
  }
  const transition: InitialTransitionDefinition<TContext, TEvent, TODO> = {
    source: stateNode,
    actions:
      !_target || typeof _target === 'string' ? [] : toArray(_target.actions),
    eventType: null as any,
    reenter: false,
    target: resolvedTarget ? [resolvedTarget] : []
  };

  return transition;
}
