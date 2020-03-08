import {
  getEventType,
  toStateValue,
  mapValues,
  path,
  flatten,
  toArray,
  keys,
  isString,
  toInvokeConfig
} from './utils';
import {
  Event,
  Transitions,
  EventObject,
  HistoryStateNodeConfig,
  StateNodeDefinition,
  TransitionDefinition,
  DelayedTransitionDefinition,
  StateNodeConfig,
  StateSchema,
  StatesDefinition,
  StateNodesConfig,
  FinalStateNodeConfig,
  InvokeDefinition,
  ActionObject,
  Mapper,
  PropertyMapper,
  NullEvent,
  SCXML,
  TransitionDefinitionMap,
  InitialTransitionDefinition
} from './types';
import { matchesState } from './utils';
import { State } from './State';
import * as actionTypes from './actionTypes';
import { toActionObject } from './actions';
import { formatInitialTransition } from './stateUtils';
import {
  getDelayedTransitions,
  formatTransitions,
  getCandidates,
  getStateNodeById,
  evaluateGuard,
  isStateId
} from './stateUtils';
import { MachineNode } from './MachineNode';
import { STATE_DELIMITER, NULL_EVENT } from './constants';

const EMPTY_OBJECT = {};

interface StateNodeOptions<TContext, TEvent extends EventObject> {
  _key: string;
  _parent?: StateNode<TContext, any, TEvent>;
}

export class StateNode<
  TContext = any,
  TStateSchema extends StateSchema = any,
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
   * Whether the state node is "transient". A state node is considered transient if it has
   * an immediate transition from a "null event" (empty string), taken upon entering the state node.
   */
  public isTransient: boolean;
  /**
   * The child state nodes.
   */
  public states: StateNodesConfig<TContext, TStateSchema, TEvent>;
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
  public entry: Array<ActionObject<TContext, TEvent>>;
  /**
   * The action(s) to be executed upon exiting the state node.
   */
  public exit: Array<ActionObject<TContext, TEvent>>;
  /**
   * The parent state node.
   */
  public parent?: StateNode<TContext, any, TEvent>;
  /**
   * The root machine node.
   */
  public machine: MachineNode<TContext, any, TEvent>;
  /**
   * The meta data associated with this state node, which will be returned in State instances.
   */
  public meta?: TStateSchema extends { meta: infer D } ? D : any;
  /**
   * The data sent with the "done.state._id_" event if this is a final state node.
   */
  public data?: Mapper<TContext, TEvent> | PropertyMapper<TContext, TEvent>;
  /**
   * The order this state node appears. Corresponds to the implicit SCXML document order.
   */
  public order: number = -1;

  protected __cache = {
    events: undefined as Array<TEvent['type']> | undefined,
    initialState: undefined as State<TContext, TEvent> | undefined,
    on: undefined as TransitionDefinitionMap<TContext, TEvent> | undefined,
    transitions: undefined as
      | Array<TransitionDefinition<TContext, TEvent>>
      | undefined,
    candidates: {} as {
      [K in TEvent['type'] | NullEvent['type'] | '*']:
        | Array<
            TransitionDefinition<
              TContext,
              K extends TEvent['type']
                ? Extract<TEvent, { type: K }>
                : EventObject
            >
          >
        | undefined;
    },
    delayedTransitions: undefined as
      | Array<DelayedTransitionDefinition<TContext, TEvent>>
      | undefined,
    invoke: undefined as Array<InvokeDefinition<TContext, TEvent>> | undefined
  };

  public idMap: Record<string, StateNode<TContext, any, TEvent>> = {};

  constructor(
    /**
     * The raw config used to create the machine.
     */
    public config: StateNodeConfig<TContext, TStateSchema, TEvent>,
    options: StateNodeOptions<TContext, TEvent>
  ) {
    const isMachine = !this.parent;
    this.parent = options._parent;
    this.key = this.config.key || options._key;
    this.machine = this.parent
      ? this.parent.machine
      : ((this as unknown) as MachineNode<TContext, TStateSchema, TEvent>);
    this.path = this.parent ? this.parent.path.concat(this.key) : [];
    this.id =
      this.config.id ||
      [this.machine.key, ...this.path].join(
        isMachine
          ? this.config.delimiter || STATE_DELIMITER
          : this.machine.delimiter
      );
    this.type =
      this.config.type ||
      (this.config.states && keys(this.config.states).length
        ? 'compound'
        : this.config.history
        ? 'history'
        : 'atomic');

    this.states = (this.config.states
      ? mapValues(
          this.config.states,
          (stateConfig: StateNodeConfig<TContext, any, TEvent>, key) => {
            const stateNode = new StateNode(stateConfig, {
              _parent: this,
              _key: key
            });
            Object.assign(this.idMap, {
              [stateNode.id]: stateNode,
              ...stateNode.idMap
            });
            return stateNode;
          }
        )
      : EMPTY_OBJECT) as StateNodesConfig<TContext, TStateSchema, TEvent>;

    // History config
    this.history =
      this.config.history === true ? 'shallow' : this.config.history || false;

    this.isTransient = !this.config.on
      ? false
      : Array.isArray(this.config.on)
      ? this.config.on.some(({ event }: { event: string }) => {
          return event === NULL_EVENT;
        })
      : NULL_EVENT in this.config.on;

    this.entry = toArray(this.config.entry).map(action =>
      toActionObject(action)
    );

    this.exit = toArray(this.config.exit).map(action => toActionObject(action));
    this.meta = this.config.meta;
    this.data =
      this.type === 'final'
        ? (this.config as FinalStateNodeConfig<TContext, TEvent>).data
        : undefined;
  }

  /**
   * The well-structured state node definition.
   */
  public get definition(): StateNodeDefinition<TContext, TStateSchema, TEvent> {
    return {
      id: this.id,
      key: this.key,
      version: this.machine.version,
      context: this.machine.context!,
      type: this.type,
      initial: this.initial
        ? {
            target: this.initial.target,
            source: this,
            actions: this.initial.actions,
            eventType: null as any,
            toJSON: () => ({
              target: this.initial!.target!.map(t => `#${t.id}`),
              source: `#${this.id}`,
              actions: this.initial!.actions,
              eventType: null as any
            })
          }
        : undefined,
      history: this.history,
      states: mapValues(
        this.states,
        (state: StateNode<TContext, any, TEvent>) => {
          return state.definition;
        }
      ) as StatesDefinition<TContext, TStateSchema, TEvent>,
      on: this.on,
      transitions: this.transitions,
      entry: this.entry,
      exit: this.exit,
      meta: this.meta,
      order: this.order || -1,
      data: this.data,
      invoke: this.invoke
    };
  }

  public toJSON() {
    return this.definition;
  }

  /**
   * The services invoked by this state node.
   */
  public get invoke(): Array<InvokeDefinition<TContext, TEvent>> {
    return (
      this.__cache.invoke ||
      (this.__cache.invoke = toArray(this.config.invoke).map((invocable, i) => {
        const id = `${this.id}:invocation[${i}]`;

        const invokeConfig = toInvokeConfig(invocable, id);
        const resolvedId = invokeConfig.id || id;

        const resolvedSrc = isString(invokeConfig.src)
          ? invokeConfig.src
          : resolvedId;

        if (
          !this.machine.options.services[resolvedSrc] &&
          !isString(invokeConfig.src)
        ) {
          this.machine.options.services = {
            ...this.machine.options.services,
            [resolvedSrc]: invokeConfig.src as any
          };
        }

        return {
          type: actionTypes.invoke,
          ...invokeConfig,
          src: resolvedSrc,
          id: resolvedId
        };
      }))
    );
  }

  /**
   * The mapping of events to transitions.
   */
  public get on(): TransitionDefinitionMap<TContext, TEvent> {
    if (this.__cache.on) {
      return this.__cache.on;
    }

    const transitions = this.transitions;

    return (this.__cache.on = transitions.reduce(
      (map, transition) => {
        map[transition.eventType] = map[transition.eventType] || [];
        map[transition.eventType].push(transition as any);
        return map;
      },
      {} as TransitionDefinitionMap<TContext, TEvent>
    ));
  }

  public get after(): Array<DelayedTransitionDefinition<TContext, TEvent>> {
    return (
      this.__cache.delayedTransitions ||
      ((this.__cache.delayedTransitions = getDelayedTransitions(this)),
      this.__cache.delayedTransitions)
    );
  }

  /**
   * All the transitions that can be taken from this state node.
   */
  public get transitions(): Array<TransitionDefinition<TContext, TEvent>> {
    return (
      this.__cache.transitions ||
      ((this.__cache.transitions = formatTransitions(this)),
      this.__cache.transitions)
    );
  }

  public get initial(): InitialTransitionDefinition<TContext, TEvent> {
    return formatInitialTransition(this, this.config.initial || []);
  }

  /**
   * Returns `true` if this state node explicitly handles the given event.
   *
   * @param event The event in question
   */
  public handles(event: Event<TEvent>): boolean {
    const eventType = getEventType<TEvent>(event);

    return this.events.includes(eventType);
  }

  public next(
    state: State<TContext, TEvent>,
    _event: SCXML.Event<TEvent>
  ): Transitions<TContext, TEvent> | undefined {
    const eventName = _event.name;
    const actions: Array<ActionObject<TContext, TEvent>> = [];

    let selectedTransition: TransitionDefinition<TContext, TEvent> | undefined;

    const candidates =
      this.__cache.candidates[eventName] ||
      (this.__cache.candidates[eventName] = getCandidates(this, eventName));

    for (const candidate of candidates) {
      const { cond, in: stateIn } = candidate;
      const resolvedContext = state.context;

      const isInState = stateIn
        ? isString(stateIn) && isStateId(stateIn)
          ? // Check if in state by ID
            state.matches(
              toStateValue(
                getStateNodeById(this, stateIn).path,
                this.machine.delimiter
              )
            )
          : // Check if in state by relative grandparent
            matchesState(
              toStateValue(stateIn, this.machine.delimiter),
              path(this.path.slice(0, -2))(state.value)
            )
        : true;

      let guardPassed = false;

      try {
        guardPassed =
          !cond ||
          evaluateGuard(this.machine, cond, resolvedContext, _event, state);
      } catch (err) {
        throw new Error(
          `Unable to evaluate guard '${cond!.name ||
            cond!
              .type}' in transition for event '${eventName}' in state node '${
            this.id
          }':\n${err.message}`
        );
      }

      if (guardPassed && isInState) {
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
    let target: string | undefined;
    if (this.type === 'history') {
      const historyConfig = this.config as HistoryStateNodeConfig<
        TContext,
        TEvent
      >;
      return historyConfig.target;
    }

    return target;
  }

  /**
   * All the state node IDs of this state node and its descendant state nodes.
   */
  public get stateIds(): string[] {
    const childStateIds = flatten(
      keys(this.states).map(stateKey => {
        return this.states[stateKey].stateIds;
      })
    );
    return [this.id].concat(childStateIds);
  }

  /**
   * All the event types accepted by this state node and its descendants.
   */
  public get events(): Array<TEvent['type']> {
    if (this.__cache.events) {
      return this.__cache.events;
    }
    const { states } = this;
    const events = new Set(this.ownEvents);

    if (states) {
      for (const stateId of keys(states)) {
        const state = states[stateId];
        if (state.states) {
          for (const event of state.events) {
            events.add(`${event}`);
          }
        }
      }
    }

    return (this.__cache.events = Array.from(events));
  }

  /**
   * All the events that have transitions directly from this state node.
   *
   * Excludes any inert events.
   */
  public get ownEvents(): Array<TEvent['type']> {
    const events = new Set(
      this.transitions
        .filter(transition => {
          return !(
            !transition.target &&
            !transition.actions.length &&
            transition.internal
          );
        })
        .map(transition => transition.eventType)
    );

    return Array.from(events);
  }
}
