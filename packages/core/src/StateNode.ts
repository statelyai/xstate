import { NULL_EVENT, STATE_DELIMITER } from './constants.ts';
import { createInvokeTimeoutEvent } from './eventUtils.ts';
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
  MachineContext,
  Mapper,
  StateNodesConfig,
  TransitionDefinition,
  TransitionDefinitionMap,
  AnyStateMachine,
  AnyStateNodeConfig,
  NonReducibleUnknown,
  EventDescriptor,
  AnyActorRef,
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
  public transitions!: Map<string, AnyTransitionDefinition[]>;
  public always?: Array<AnyTransitionDefinition>;

  constructor(
    /** The raw config used to create the machine. */
    public config: AnyStateNodeConfig,
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

    this.entry = this.config.entry as AnyAction | undefined;
    this.exit = this.config.exit as AnyAction | undefined;

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
    if (this.type === 'choice') {
      this.always = formatChoiceTransitions(this);
    } else if (this.config.always) {
      this.always = toTransitionConfigArray(this.config.always).map((t) =>
        typeof t === 'function' ? t : formatTransition(this, NULL_EVENT, t)
      );
    }

    Object.keys(this.states).forEach((key) => {
      this.states[key]._initialize();
    });
  }

  /** The logic invoked as actors by this state node. */
  public get invoke(): Array<AnyInvokeDefinition> {
    return memo(this, 'invoke', () =>
      toArray(this.config.invoke).map((invokeConfig, i) => {
        const { src, systemId } = invokeConfig;
        const resolvedId = invokeConfig.id ?? createInvokeId(this.id, i);
        const sourceName = `xstate.invoke.${createInvokeId(this.id, i)}`;

        return {
          ...invokeConfig,
          src: sourceName,
          logic: src,
          id: resolvedId,
          systemId: systemId
        } as AnyInvokeDefinition;
      })
    );
  }

  /** The mapping of events to transitions. */
  public get on(): TransitionDefinitionMap<any, any> {
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

  public get after(): Array<DelayedTransitionDefinition<any, any>> {
    return memo(
      this,
      'delayedTransitions',
      () => getDelayedTransitions(this) as any
    );
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
    self: AnyActorRef
  ): Array<AnyTransitionDefinition> | undefined {
    const eventType = event.type;

    let selectedTransition: AnyTransitionDefinition | undefined;

    const candidates: Array<AnyTransitionDefinition> = memo(
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
  public get events(): Array<EventDescriptor<any>> {
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
  public get ownEvents(): Array<EventDescriptor<any>> {
    const keys = Object.keys(Object.fromEntries(this.transitions));
    const events = new Set(
      keys.filter((descriptor) => {
        return this.transitions.get(descriptor)!.some(
          (transition) =>
            transition.target ||
            // transition.actions.length ||
            transition.reenter ||
            transition.to
        );
      })
    );

    return Array.from(events);
  }
}

function validateStateNodeConfig(stateNode: AnyStateNode) {
  const config = stateNode.config as any;

  if (stateNode.type !== 'choice') {
    if (config.choices !== undefined) {
      throw new Error(
        `State "${stateNode.id}" has \`choices\`, but \`choices\` can only be used with \`type: 'choice'\`.`
      );
    }
    return;
  }

  if (config.choices === undefined) {
    throw new Error(`Choice state "${stateNode.id}" must declare \`choices\`.`);
  }

  for (const key of CHOICE_CONFIG_KEYS) {
    if (config[key] !== undefined) {
      throw new Error(
        `Choice state "${stateNode.id}" cannot declare \`${key}\`.`
      );
    }
  }
}

function validateChoiceTarget(
  stateNode: AnyStateNode,
  choice: AnyTransitionConfig,
  index: number
) {
  if (choice.target === undefined) {
    throw new Error(
      `Choice state "${stateNode.id}" has a choice at index ${index} without a target.`
    );
  }
  if (typeof choice.guard === 'string') {
    throw new Error(
      `Choice state "${stateNode.id}" cannot declare a string guard. Use a guard object or inline guard function.`
    );
  }
  validatePureChoiceResult(stateNode, choice);
}

function validatePureChoiceResult(
  stateNode: AnyStateNode,
  result: AnyTransitionConfig
) {
  for (const key of ['actions', 'to', 'context'] as const) {
    if ((result as any)[key] !== undefined) {
      throw new Error(
        `Choice state "${stateNode.id}" cannot declare \`${key}\` on a choice.`
      );
    }
  }
}

function validateChoiceResult(
  stateNode: AnyStateNode,
  result: any
): AnyTransitionConfig {
  if (!result || result.target === undefined) {
    throw new Error(`Choice state "${stateNode.id}" must resolve to a target.`);
  }
  validatePureChoiceResult(stateNode, result);
  return result;
}

function formatChoiceTransitions(
  stateNode: AnyStateNode
): AnyTransitionDefinition[] {
  const choices = (stateNode.config as any).choices;

  if (typeof choices === 'function') {
    return [
      formatTransition(stateNode, NULL_EVENT, {
        to: (args: any) => validateChoiceResult(stateNode, choices(args))
      } as AnyTransitionConfig)
    ];
  }

  if (!Array.isArray(choices) || choices.length === 0) {
    throw new Error(
      `Choice state "${stateNode.id}" must declare at least one choice.`
    );
  }

  let hasDefault = false;
  const transitions = choices.map((choice, index) => {
    validateChoiceTarget(stateNode, choice, index);
    if (choice.guard === undefined) {
      hasDefault = true;
    }
    return formatTransition(stateNode, NULL_EVENT, choice);
  });

  if (!hasDefault) {
    throw new Error(
      `Choice state "${stateNode.id}" must declare a default choice without a guard.`
    );
  }

  return transitions;
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
        toTransitionConfigArray(transitionsConfig as any).map((t) =>
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
      toTransitionConfigArray(stateNode.config.onDone as any).map((t) =>
        typeof t === 'function' ? t : formatTransition(stateNode, descriptor, t)
      )
    );
  }
  for (const invokeDef of stateNode.invoke) {
    const invokeTimeoutEventType =
      invokeDef.timeout !== undefined
        ? createInvokeTimeoutEvent(invokeDef.id).type
        : undefined;

    if (invokeDef.onDone) {
      const descriptor = `xstate.done.actor.${invokeDef.id}`;
      const invokeDoneTransitions = toTransitionConfigArray(
        invokeDef.onDone as any
      ).map((t) =>
        invokeTimeoutEventType
          ? formatInvokeCompletionTransition(
              stateNode,
              descriptor,
              t,
              invokeTimeoutEventType
            )
          : formatTransition(stateNode, descriptor, t)
      );

      if (invokeTimeoutEventType) {
        invokeDoneTransitions.push(
          createCancelInvokeTimeoutTransition(
            stateNode,
            descriptor,
            invokeTimeoutEventType
          )
        );
      }

      transitions.set(descriptor, invokeDoneTransitions);
    } else if (invokeTimeoutEventType) {
      const descriptor = `xstate.done.actor.${invokeDef.id}`;
      transitions.set(descriptor, [
        createCancelInvokeTimeoutTransition(
          stateNode,
          descriptor,
          invokeTimeoutEventType
        )
      ]);
    }
    if (invokeDef.onError) {
      const descriptor = `xstate.error.actor.${invokeDef.id}`;
      transitions.set(
        descriptor,
        toTransitionConfigArray(invokeDef.onError as any).map((t) =>
          invokeTimeoutEventType
            ? formatInvokeCompletionTransition(
                stateNode,
                descriptor,
                t,
                invokeTimeoutEventType
              )
            : formatTransition(stateNode, descriptor, t)
        )
      );
    }
    if (invokeDef.onSnapshot) {
      const descriptor = `xstate.snapshot.${invokeDef.id}`;
      transitions.set(
        descriptor,
        toTransitionConfigArray(invokeDef.onSnapshot as any).map((t) =>
          formatTransition(stateNode, descriptor, t)
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

function createCancelInvokeTimeoutTransition(
  stateNode: AnyStateNode,
  descriptor: string,
  timeoutEventType: string
): AnyTransitionDefinition {
  return formatTransition(stateNode, descriptor, {
    to: (_args: any, enq: any) => {
      enq.cancel(timeoutEventType);
      return {};
    }
  } as AnyTransitionConfig);
}

function formatInvokeCompletionTransition(
  stateNode: AnyStateNode,
  descriptor: string,
  transitionConfig: AnyTransitionConfig,
  timeoutEventType: string
): AnyTransitionDefinition {
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
          enq.cancel(timeoutEventType);
        }

        return result;
      }

      enq.cancel(timeoutEventType);
      return {
        target,
        reenter
      };
    }
  } as AnyTransitionConfig);
}

export function formatInitialTransition(
  stateNode: AnyStateNode,
  _target: string | { target: string; input?: any } | undefined
): InitialTransitionDefinition {
  const targetString =
    typeof _target === 'object' && _target !== null ? _target.target : _target;
  const input =
    typeof _target === 'object' && _target !== null ? _target.input : undefined;
  const resolvedTarget =
    typeof targetString === 'string'
      ? stateNode.states[targetString]
      : undefined;
  if (!resolvedTarget && targetString) {
    throw new Error(
      `Initial state node "${targetString}" not found on parent state node #${stateNode.id}`
    );
  }
  const transition: InitialTransitionDefinition = {
    source: stateNode,
    target: resolvedTarget ? [resolvedTarget] : undefined,
    input
  };

  return transition;
}
