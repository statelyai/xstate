import isDevelopment from '#is-development';
import { NULL_EVENT, STATE_DELIMITER } from './constants.ts';
import type { SetupStateSchemas } from './schema.types.ts';
import { createInvokeTimeoutEventId } from './eventUtils.ts';
import { memo } from './memo.ts';
import {
  evaluateCandidate,
  formatTransition,
  getCandidates,
  getEventDescriptorKey,
  getDelayedTransitions,
  matchesActorSession,
  type TransitionSelectionResults
} from './stateUtils.ts';
import type {
  DelayedTransitionDefinition,
  EventObject,
  InitialTransitionDefinition,
  MachineContext,
  Mapper,
  StateNodesConfig,
  TransitionDefinition,
  TransitionDefinitionMap,
  AnyStateMachine,
  AnyStateNodeConfig,
  NonReducibleUnknown,
  EventDescriptor,
  AnyActorScope,
  AnyStateNode,
  AnyEventObject,
  AnyAction,
  AnyTransitionConfig,
  AnyTransitionDefinition,
  AnyMachineSnapshot,
  AnyInvokeDefinition
} from './types.ts';
import {
  createInvokeId,
  mapValues,
  toArray,
  toTransitionConfigArray
} from './utils.ts';

const EMPTY_OBJECT = {};
const CHOICE_CONFIG_KEYS = [
  'invoke',
  'after',
  'on',
  'entry',
  'exit',
  'always',
  'states',
  'initial',
  'onDone',
  'timeout',
  'onTimeout',
  'history',
  'target',
  'output'
] as const;

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
   * - `'choice'` - pure routing decision state node
   * - `'final'` - final state node
   */
  public type:
    | 'atomic'
    | 'compound'
    | 'parallel'
    | 'final'
    | 'history'
    | 'choice';
  /** The string path from the root machine node to this node. */
  public path: string[];
  /** The child state nodes. */
  public states: StateNodesConfig<any, any>;
  /**
   * The type of history on this state node. Can be:
   *
   * - `'shallow'` - recalls only top-level historical state value
   * - `'deep'` - recalls historical state value at all levels
   */
  public history: false | 'shallow' | 'deep';
  /** The action(s) to be executed upon entering the state node. */
  public entry: AnyAction | undefined;
  /** The action(s) to be executed upon exiting the state node. */
  public exit: AnyAction | undefined;
  /** The parent state node. */
  public parent?: StateNode<any, any>;
  /** The root machine node. */
  public machine: AnyStateMachine;
  /**
   * The meta data associated with this state node, which will be returned in
   * State instances.
   */
  public meta?: any;
  /**
   * The output data sent with the `xstate.done.state` event if this is a final
   * state node.
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

  public schemas: SetupStateSchemas | undefined;

  public tags: string[] = [];
  public transitions!: Map<string, AnyTransitionDefinition[]>;
  public always?: Array<AnyTransitionDefinition>;
  public invoke: Array<AnyInvokeDefinition>;
  public on!: TransitionDefinitionMap<any, any>;
  public after!: Array<DelayedTransitionDefinition<any, any>>;
  public events!: Array<EventDescriptor<any>>;
  public ownEvents!: Array<EventDescriptor<any>>;
  private cc?: Map<string, AnyTransitionDefinition[]>;

  constructor(
    /** The raw config used to create the machine. */
    public config: AnyStateNodeConfig,
    options: StateNodeOptions<TContext, TEvent>
  ) {
    this.parent = options._parent;
    this.key = options._key;
    this.machine = options._machine;
    this.path = this.parent ? this.parent.path.concat(this.key) : [];
    const firstStateKey = this.config.states
      ? Object.keys(this.config.states)[0]
      : undefined;
    this.id =
      this.config.id || [this.machine.id, ...this.path].join(STATE_DELIMITER);
    this.type =
      this.config.type ||
      (firstStateKey !== undefined
        ? 'compound'
        : this.config.history
          ? 'history'
          : 'atomic');
    this.description = this.config.description;
    this.schemas = this.config.schemas;

    validateStateNodeConfig(this);

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
        isDevelopment
          ? `No initial state specified for compound state node "#${
              this.id
            }". Try adding { initial: "${firstStateKey}" } to the state config.`
          : `No initial state specified for compound state node "#${this.id}".`
      );
    }

    // History config
    this.history =
      this.config.history === true ? 'shallow' : this.config.history || false;

    this.entry = this.config.entry as AnyAction | undefined;
    this.exit = this.config.exit as AnyAction | undefined;

    this.meta = this.config.meta;
    this.output =
      this.type === 'final' || !this.parent ? this.config.output : undefined;
    this.tags = toArray(config.tags).slice();
    this.invoke = toArray(this.config.invoke).map((invokeConfig, i) => {
      const { src, registryKey } = invokeConfig;
      const invokeId = createInvokeId(this.id, i);
      const resolvedId = invokeConfig.id ?? invokeId;
      // Referenced (string) actors keep their logical name so persisted
      // snapshots reference `src: 'fetchUser'` rather than a positional id;
      // only inline logic gets the synthetic source name.
      const sourceName =
        typeof src === 'string' ? src : `xstate.invoke.${invokeId}`;

      return {
        ...invokeConfig,
        src: sourceName,
        logic: src,
        id: resolvedId,
        registryKey
      } as AnyInvokeDefinition;
    });
  }

  /** @internal */
  public _initialize() {
    this.after = getDelayedTransitions(this) as any;
    this.transitions = formatTransitions(this);
    if (this.type === 'choice') {
      this.always = formatChoiceTransitions(this);
    } else if (this.config.always) {
      this.always = mapTransitionConfigs(this.config.always, (transition) =>
        formatTransition(this, NULL_EVENT, transition)
      );
    }

    for (const key of Object.keys(this.states)) {
      this.states[key]._initialize();
    }

    this._refreshEventMetadata();
  }

  /** @internal */
  public _refreshEventMetadata() {
    const on = {} as TransitionDefinitionMap<TContext, TEvent>;
    const ownEvents: EventDescriptor<any>[] = [];
    for (const [descriptor, transitions] of this.transitions) {
      (on as any)[descriptor] = transitions.slice();
      if (
        transitions.some(
          (transition) =>
            transition.target || transition.reenter || transition.to
        )
      ) {
        ownEvents.push(descriptor);
      }
    }
    this.on = on;
    this.ownEvents = ownEvents;

    const events = new Set<EventDescriptor<any>>(ownEvents);
    for (const state of Object.values(this.states)) {
      for (const event of state.events) {
        events.add(event);
      }
    }
    this.events = Array.from(events);
  }

  public get initial(): InitialTransitionDefinition {
    return memo(this, 'initial', () =>
      formatInitialTransition(this, this.config.initial)
    );
  }

  /** @internal */
  public next(
    snapshot: AnyMachineSnapshot,
    event: AnyEventObject,
    actorScope: AnyActorScope,
    selectionResults?: TransitionSelectionResults
  ): Array<AnyTransitionDefinition> | undefined {
    const descriptorKey = getEventDescriptorKey(event);
    let candidates = this.cc?.get(descriptorKey);
    if (!candidates) {
      candidates = getCandidates(this, event);
      (this.cc ??= new Map()).set(descriptorKey, candidates);
    }

    for (const candidate of candidates) {
      const guardPassed = evaluateCandidate(
        candidate,
        event,
        snapshot,
        this,
        actorScope,
        selectionResults
      );

      if (guardPassed) {
        return [candidate];
      }
    }

    return undefined;
  }
}

function validateStateNodeConfig(stateNode: AnyStateNode) {
  const config = stateNode.config as any;

  if (
    stateNode.type === 'history' &&
    !(
      (typeof config.target === 'string' && config.target.trim().length > 0) ||
      (Array.isArray(config.target) &&
        config.target.length > 0 &&
        config.target.every(
          (target: unknown) =>
            typeof target === 'string' && target.trim().length > 0
        ))
    )
  ) {
    throw new Error(
      isDevelopment
        ? `History state "${stateNode.id}" must declare a non-empty \`target\`.`
        : `Missing history target on "${stateNode.id}"`
    );
  }

  if (stateNode.type !== 'choice') {
    if (isDevelopment && config.choice !== undefined) {
      throw new Error(
        `State "${stateNode.id}" has \`choice\`, but \`choice\` can only be used with \`type: 'choice'\`.`
      );
    }
    return;
  }

  if (typeof config.choice !== 'function') {
    throw new Error(
      isDevelopment
        ? `Choice state "${stateNode.id}" must declare a \`choice\` function.`
        : `Missing \`choice\` function on "${stateNode.id}"`
    );
  }

  if (isDevelopment) {
    for (const key of CHOICE_CONFIG_KEYS) {
      if (config[key] !== undefined) {
        throw new Error(
          `Choice state "${stateNode.id}" cannot declare \`${key}\`.`
        );
      }
    }
  }
}

function formatChoiceTransitions(
  stateNode: AnyStateNode
): AnyTransitionDefinition[] {
  const choice = (stateNode.config as any).choice;
  const validateChoiceResult = (result: any): AnyTransitionConfig => {
    if (!result || result.target === undefined) {
      throw new Error(
        isDevelopment
          ? `Choice state "${stateNode.id}" must resolve to a target.`
          : `Choice "${stateNode.id}" has no target`
      );
    }
    if (isDevelopment) {
      for (const key of ['actions', 'to'] as const) {
        if (result[key] !== undefined) {
          throw new Error(
            `Choice state "${stateNode.id}" cannot declare \`${key}\` on a choice.`
          );
        }
      }
    }
    return result;
  };

  return [
    formatTransition(stateNode, NULL_EVENT, {
      to: (args: any) => validateChoiceResult(choice(args))
    } as AnyTransitionConfig)
  ];
}

function mapTransitionConfigs<T>(
  transitionsConfig: unknown,
  mapper: (transition: AnyTransitionConfig) => T
): T[] {
  const transitionConfigs = toTransitionConfigArray(transitionsConfig as any);
  const transitions = new Array<T>(transitionConfigs.length);

  for (let i = 0; i < transitionConfigs.length; i++) {
    transitions[i] = mapper(transitionConfigs[i]);
  }

  return transitions;
}

function formatTransitions<
  TContext extends MachineContext,
  TEvent extends EventObject
>(
  stateNode: AnyStateNode
): Map<string, TransitionDefinition<TContext, TEvent>[]> {
  const transitions = new Map<
    string,
    TransitionDefinition<TContext, AnyEventObject>[]
  >();
  const addTransitions = (
    descriptor: string,
    additions: AnyTransitionDefinition[]
  ) => {
    transitions.set(descriptor, [
      ...(transitions.get(descriptor) ?? []),
      ...additions
    ]);
  };
  if (stateNode.config.on) {
    for (const descriptor of Object.keys(stateNode.config.on)) {
      if (descriptor === NULL_EVENT) {
        throw new Error(
          isDevelopment
            ? 'Null events ("") cannot be specified as a transition key. Use `always: { ... }` instead.'
            : 'Null event transition key'
        );
      }
      const transitionsConfig = stateNode.config.on[descriptor];
      transitions.set(
        descriptor,
        mapTransitionConfigs(transitionsConfig, (transition) =>
          formatTransition(stateNode, descriptor, transition)
        )
      );
    }
  }
  if (stateNode.config.onDone) {
    const descriptor = 'xstate.done.state';
    addTransitions(
      descriptor,
      mapTransitionConfigs(stateNode.config.onDone, (transition) =>
        formatTransition(stateNode, descriptor, {
          ...transition,
          matches: { ...transition.matches, stateId: stateNode.id }
        })
      )
    );
  }
  if (stateNode.config.onError) {
    const descriptor = 'xstate.error.*';
    transitions.set(
      descriptor,
      mapTransitionConfigs(stateNode.config.onError, (transition) =>
        formatTransition(stateNode, descriptor, transition)
      )
    );
  }
  const createCancelInvokeTimeoutTransition = (
    descriptor: string,
    timeoutEventId: string,
    actorId: string
  ): AnyTransitionDefinition =>
    formatTransition(stateNode, descriptor, {
      matches: { actorId },
      _eventMatcher: (event: EventObject, snapshot: AnyMachineSnapshot) =>
        matchesActorSession(event, snapshot, actorId),
      to: (_args: any, enq: any) => {
        enq.cancel(timeoutEventId);
        return {};
      }
    } as AnyTransitionConfig);
  const formatInvokeCompletionTransition = (
    descriptor: string,
    transitionConfig: AnyTransitionConfig,
    timeoutEventId: string
  ): AnyTransitionDefinition => {
    const { target, to, reenter, ...rest } = transitionConfig;

    return formatTransition(stateNode, descriptor, {
      ...rest,
      reenter,
      to: (args: any, enq: any) => {
        if (to) {
          let didEnqueue = false;
          const trackingEnqueue = new Proxy(enq, {
            apply(target, thisArg, argArray) {
              didEnqueue = true;
              return Reflect.apply(target, thisArg, argArray);
            },
            get(target, prop, receiver) {
              const value = Reflect.get(target, prop, receiver);

              if (typeof value !== 'function') {
                return value;
              }

              return (...argArray: any[]) => {
                didEnqueue = true;
                return value.apply(target, argArray);
              };
            }
          });
          const result = to(args, trackingEnqueue);

          if (result !== undefined || didEnqueue) {
            enq.cancel(timeoutEventId);
          }

          return result;
        }

        enq.cancel(timeoutEventId);
        return {
          target,
          reenter
        };
      }
    } as AnyTransitionConfig);
  };
  for (const invokeDef of stateNode.invoke) {
    const withInvokeMatch = (transition: AnyTransitionConfig) => ({
      ...transition,
      matches: { ...transition.matches, actorId: invokeDef.id },
      _eventMatcher: (event: EventObject, snapshot: AnyMachineSnapshot) =>
        matchesActorSession(event, snapshot, invokeDef.id)
    });
    const invokeTimeoutEventId =
      invokeDef.timeout !== undefined
        ? createInvokeTimeoutEventId(invokeDef.id)
        : undefined;

    if (invokeDef.onDone) {
      const descriptor = 'xstate.done.actor';
      const invokeDoneTransitions = mapTransitionConfigs(
        invokeDef.onDone,
        (rawTransition) => {
          const transition = withInvokeMatch(rawTransition);
          return invokeTimeoutEventId
            ? formatInvokeCompletionTransition(
                descriptor,
                transition,
                invokeTimeoutEventId
              )
            : formatTransition(stateNode, descriptor, transition);
        }
      );

      if (invokeTimeoutEventId) {
        invokeDoneTransitions.push(
          createCancelInvokeTimeoutTransition(
            descriptor,
            invokeTimeoutEventId,
            invokeDef.id
          )
        );
      }

      addTransitions(descriptor, invokeDoneTransitions);
    } else if (invokeTimeoutEventId) {
      const descriptor = 'xstate.done.actor';
      addTransitions(descriptor, [
        createCancelInvokeTimeoutTransition(
          descriptor,
          invokeTimeoutEventId,
          invokeDef.id
        )
      ]);
    }
    if (invokeDef.onError) {
      const descriptor = 'xstate.error.actor';
      addTransitions(
        descriptor,
        mapTransitionConfigs(invokeDef.onError, (rawTransition) => {
          const transition = withInvokeMatch(rawTransition);
          return invokeTimeoutEventId
            ? formatInvokeCompletionTransition(
                descriptor,
                transition,
                invokeTimeoutEventId
              )
            : formatTransition(stateNode, descriptor, transition);
        })
      );
    }
    if (invokeDef.onSnapshot) {
      const descriptor = 'xstate.snapshot.actor';
      addTransitions(
        descriptor,
        mapTransitionConfigs(invokeDef.onSnapshot, (transition) =>
          formatTransition(stateNode, descriptor, withInvokeMatch(transition))
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
    existing.push(
      delayedTransition as TransitionDefinition<TContext, AnyEventObject>
    );
  }
  return transitions as Map<string, TransitionDefinition<TContext, any>[]>;
}

function formatInitialTransition(
  stateNode: AnyStateNode,
  _target:
    | string
    | { target: string | string[]; input?: any; to?: (...args: any[]) => any }
    | undefined
): InitialTransitionDefinition {
  const targetString =
    typeof _target === 'object' && _target !== null ? _target.target : _target;
  const input =
    typeof _target === 'object' && _target !== null ? _target.input : undefined;
  const to =
    typeof _target === 'object' && _target !== null ? _target.to : undefined;
  const targetStrings = Array.isArray(targetString)
    ? targetString
    : targetString
      ? [targetString]
      : [];
  const resolvedTargets = targetStrings.map((target) =>
    target.startsWith('#')
      ? stateNode.machine.getStateNodeById(target.slice(1))
      : stateNode.states[target]
  );
  if (resolvedTargets.some((target) => !target)) {
    throw new Error(
      isDevelopment
        ? `Initial state node "${targetStrings.find((_, index) => !resolvedTargets[index])}" not found on parent state node #${stateNode.id}`
        : `Initial state not found on "#${stateNode.id}"`
    );
  }
  const transition: InitialTransitionDefinition = {
    source: stateNode,
    target: resolvedTargets.length
      ? (resolvedTargets as AnyStateNode[])
      : undefined,
    input,
    to
  };

  return transition;
}
