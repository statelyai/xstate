import type { State } from './State.ts';
import type { StateMachine } from './StateMachine.ts';
import { NULL_EVENT, STATE_DELIMITER } from './constants.ts';
import { evaluateGuard } from './guards.ts';
import { memo } from './memo.ts';
import {
  formatInitialTransition,
  formatTransition,
  formatTransitions,
  getCandidates,
  getDelayedTransitions
} from './stateUtils.ts';
import type {
  Action,
  AnyActorLogic,
  DelayedTransitionDefinition,
  EventObject,
  FinalStateNodeConfig,
  HistoryStateNodeConfig,
  InitialTransitionDefinition,
  InvokeDefinition,
  MachineContext,
  Mapper,
  PropertyMapper,
  StateNodeConfig,
  StateNodeDefinition,
  StateNodesConfig,
  StatesDefinition,
  TransitionDefinition,
  TransitionDefinitionMap,
  TODO
} from './types.ts';
import {
  createInvokeId,
  flatten,
  mapValues,
  toArray,
  toInvokeConfig,
  toTransitionConfigArray
} from './utils.ts';

const EMPTY_OBJECT = {};

const toSerializableActon = (action: Action<any, any, any>) => {
  if (typeof action === 'string') {
    return { type: action };
  }
  if (typeof action === 'function') {
    if ('resolve' in action) {
      return { type: (action as any).type };
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
  _machine: StateMachine<TContext, TEvent, any, any, any>;
}

export class StateNode<
  TContext extends MachineContext = MachineContext,
  TEvent extends EventObject = EventObject
> {
  /**
   * The relative key of the state node, which represents its location in the overall state value.
   */
  public key: string;
  /**
   * The unique ID of the state node.
   */
  public id: string;
  /**
   * The type of this state node:
   *
   *  - `'atomic'` - no child state nodes
   *  - `'compound'` - nested child state nodes (XOR)
   *  - `'parallel'` - orthogonal nested child state nodes (AND)
   *  - `'history'` - history state node
   *  - `'final'` - final state node
   */
  public type: 'atomic' | 'compound' | 'parallel' | 'final' | 'history';
  /**
   * The string path from the root machine node to this node.
   */
  public path: string[];
  /**
   * The child state nodes.
   */
  public states: StateNodesConfig<TContext, TEvent>;
  /**
   * The type of history on this state node. Can be:
   *
   *  - `'shallow'` - recalls only top-level historical state value
   *  - `'deep'` - recalls historical state value at all levels
   */
  public history: false | 'shallow' | 'deep';
  /**
   * The action(s) to be executed upon entering the state node.
   */
  public entry: Action<any, any, any>[];
  /**
   * The action(s) to be executed upon exiting the state node.
   */
  public exit: Action<any, any, any>[];
  /**
   * The parent state node.
   */
  public parent?: StateNode<TContext, TEvent>;
  /**
   * The root machine node.
   */
  public machine: StateMachine<TContext, TEvent, any, any, TODO, TODO>;
  /**
   * The meta data associated with this state node, which will be returned in State instances.
   */
  public meta?: any;
  /**
   * The output data sent with the "done.state._id_" event if this is a final state node.
   */
  public output?: Mapper<TContext, TEvent, any>;

  /**
   * The order this state node appears. Corresponds to the implicit document order.
   */
  public order: number = -1;

  public description?: string;

  public tags: string[] = [];
  public transitions!: Map<string, TransitionDefinition<TContext, TEvent>[]>;
  public always?: Array<TransitionDefinition<TContext, TEvent>>;

  constructor(
    /**
     * The raw config used to create the machine.
     */
    public config: StateNodeConfig<TContext, TEvent, TODO, TODO>,
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
            (
              stateConfig: StateNodeConfig<TContext, TEvent, TODO, TODO>,
              key
            ) => {
              const stateNode = new StateNode(stateConfig, {
                _parent: this,
                _key: key as string,
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

    this.entry = toArray(this.config.entry);
    this.exit = toArray(this.config.exit);

    this.meta = this.config.meta;
    this.output =
      this.type === 'final'
        ? (this.config as FinalStateNodeConfig<TContext, TEvent>).output
        : undefined;
    this.tags = toArray(config.tags);
  }

  public _initialize() {
    this.transitions = formatTransitions(this);
    if (this.config.always) {
      this.always = toTransitionConfigArray(this.config.always).map((t) =>
        formatTransition(this, NULL_EVENT, t)
      );
    }

    Object.keys(this.states).forEach((key) => {
      this.states[key]._initialize();
    });
  }

  /**
   * The well-structured state node definition.
   */
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
            actions: this.initial.actions.map(toSerializableActon),
            eventType: null as any,
            reenter: false,
            toJSON: () => ({
              target: this.initial!.target!.map((t) => `#${t.id}`),
              source: `#${this.id}`,
              actions: this.initial!.actions.map(toSerializableActon),
              eventType: null as any
            })
          }
        : undefined,
      history: this.history,
      states: mapValues(this.states, (state: StateNode<TContext, TEvent>) => {
        return state.definition;
      }) as StatesDefinition<TContext, TEvent>,
      on: this.on,
      transitions: [...this.transitions.values()].flat().map((t) => ({
        ...t,
        actions: t.actions.map(toSerializableActon)
      })),
      entry: this.entry.map(toSerializableActon),
      exit: this.exit.map(toSerializableActon),
      meta: this.meta,
      order: this.order || -1,
      output: this.output,
      invoke: this.invoke,
      description: this.description,
      tags: this.tags
    };
  }

  public toJSON() {
    return this.definition;
  }

  /**
   * The logic invoked as actors by this state node.
   */
  public get invoke(): Array<InvokeDefinition<TContext, TEvent>> {
    return memo(this, 'invoke', () =>
      toArray(this.config.invoke).map((invocable, i) => {
        const generatedId = createInvokeId(this.id, i);
        const invokeConfig = toInvokeConfig(invocable, generatedId);
        const resolvedId = invokeConfig.id || generatedId;
        const src = invokeConfig.src as string | AnyActorLogic;
        const { systemId } = invokeConfig;

        // TODO: resolving should not happen here
        const resolvedSrc =
          typeof src === 'string' ? src : !('type' in src) ? resolvedId : src;

        if (
          !this.machine.implementations.actors[resolvedId] &&
          typeof src !== 'string' &&
          !('type' in src)
        ) {
          this.machine.implementations.actors = {
            ...this.machine.implementations.actors,
            // TODO: this should accept `src` as-is
            [resolvedId]: src
          };
        }

        return {
          ...invokeConfig,
          src: resolvedSrc,
          id: resolvedId,
          systemId: systemId,
          toJSON() {
            const { onDone, onError, ...invokeDefValues } = invokeConfig;
            return {
              ...invokeDefValues,
              type: 'xstate.invoke',
              src: resolvedSrc,
              id: resolvedId
            };
          }
        } as InvokeDefinition<TContext, TEvent>;
      })
    );
  }

  /**
   * The mapping of events to transitions.
   */
  public get on(): TransitionDefinitionMap<TContext, TEvent> {
    return memo(this, 'on', () => {
      const transitions = this.transitions;

      return [...transitions]
        .flatMap(([descriptor, t]) => t.map((t) => [descriptor, t] as const))
        .reduce((map: any, [descriptor, transition]) => {
          map[descriptor] = map[descriptor] || [];
          map[descriptor].push(transition);
          return map;
        }, {} as TransitionDefinitionMap<TContext, TEvent>);
    });
  }

  public get after(): Array<DelayedTransitionDefinition<TContext, TEvent>> {
    return memo(this, 'delayedTransitions', () => getDelayedTransitions(this));
  }

  public get initial(): InitialTransitionDefinition<TContext, TEvent> {
    return memo(this, 'initial', () =>
      formatInitialTransition(this, this.config.initial || [])
    );
  }

  public next(
    state: State<TContext, TEvent, TODO>,
    event: TEvent
  ): TransitionDefinition<TContext, TEvent>[] | undefined {
    const eventType = event.type;
    const actions: Action<any, any, any>[] = [];

    let selectedTransition: TransitionDefinition<TContext, TEvent> | undefined;

    const candidates: Array<TransitionDefinition<TContext, TEvent>> = memo(
      this,
      `candidates-${eventType}`,
      () => getCandidates(this, eventType)
    );

    for (const candidate of candidates) {
      const { guard } = candidate;
      const resolvedContext = state.context;

      let guardPassed = false;

      try {
        guardPassed =
          !guard ||
          evaluateGuard<TContext, TEvent>(guard, resolvedContext, event, state);
      } catch (err: any) {
        throw new Error(
          `Unable to evaluate guard '${
            guard!.type
          }' in transition for event '${eventType}' in state node '${
            this.id
          }':\n${err.message}`
        );
      }

      if (guardPassed) {
        actions.push(...candidate.actions);
        selectedTransition = candidate;
        break;
      }
    }

    return selectedTransition ? [selectedTransition] : undefined;
  }

  /**
   * The target state value of the history state node, if it exists. This represents the
   * default state value to transition to if no history value exists yet.
   */
  public get target(): string | undefined {
    if (this.type === 'history') {
      const historyConfig = this.config as HistoryStateNodeConfig<
        TContext,
        TEvent
      >;
      return historyConfig.target;
    }

    return undefined;
  }

  /**
   * All the state node IDs of this state node and its descendant state nodes.
   */
  public get stateIds(): string[] {
    const childStateIds = flatten(
      Object.keys(this.states).map((stateKey) => {
        return this.states[stateKey].stateIds;
      })
    );
    return [this.id].concat(childStateIds);
  }

  /**
   * All the event types accepted by this state node and its descendants.
   */
  public get events(): Array<TEvent['type']> {
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
  public get ownEvents(): Array<TEvent['type']> {
    const events = new Set(
      [...this.transitions.keys()].filter((descriptor) => {
        return this.transitions
          .get(descriptor)!
          .some(
            (transition) =>
              !(
                !transition.target &&
                !transition.actions.length &&
                !transition.reenter
              )
          );
      })
    );

    return Array.from(events);
  }
}
