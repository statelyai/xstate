import { MachineSnapshot } from './State.ts';
import type { StateMachine } from './StateMachine.ts';
import { NULL_EVENT, STATE_DELIMITER } from './constants.ts';
import { memo } from './memo.ts';
import {
  evaluateCandidate,
  formatTransition,
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
  StateNodesConfig,
  TransitionDefinition,
  TransitionDefinitionMap,
  TODO,
  ParameterizedObject,
  AnyStateMachine,
  AnyStateNodeConfig,
  ProvidedActor,
  NonReducibleUnknown,
  EventDescriptor,
  AnyActorRef,
  AnyStateNode,
  InitialTransitionConfig,
  AnyEventObject,
  TransitionConfigFunction,
  AnyAction2
} from './types.ts';
import { Next_StateNodeConfig } from './types.v6.ts';
import {
  createInvokeId,
  mapValues,
  toArray,
  toTransitionConfigArray
} from './utils.ts';

const EMPTY_OBJECT = {};

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
  public entry: AnyAction2 | undefined;
  /** The action(s) to be executed upon exiting the state node. */
  public exit: AnyAction2 | undefined;
  /** The parent state node. */
  public parent?: StateNode<TContext, TEvent>;
  /** The root machine node. */
  public machine: StateMachine<
    TContext,
    TEvent,
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
    any
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
    public config: Next_StateNodeConfig<
      TContext,
      TEvent,
      any,
      any,
      any,
      any,
      any,
      any,
      any,
      any,
      any
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

    this.entry = this.config.entry;
    this.exit = this.config.exit;

    if (this.entry) {
      // @ts-ignore
      this.entry._special = true;
    }

    if (this.exit) {
      // @ts-ignore
      this.exit._special = true;
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
        const sourceName = `xstate.invoke.${createInvokeId(this.id, i)}`;

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
        // actions.push(...candidate.actions);
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
    const keys = Object.keys(Object.fromEntries(this.transitions));
    const events = new Set(
      keys.filter((descriptor) => {
        return this.transitions.get(descriptor)!.some(
          (transition) =>
            transition.target ||
            // transition.actions.length ||
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
    | InitialTransitionConfig<
        TContext,
        TEvent,
        TODO,
        TODO,
        TODO,
        TODO,
        TODO,
        TODO
      >
    | TransitionConfigFunction<
        TContext,
        TEvent,
        TEvent,
        TODO,
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
    eventType: null as any,
    reenter: false,
    target: resolvedTarget ? [resolvedTarget] : []
  };

  return transition;
}
