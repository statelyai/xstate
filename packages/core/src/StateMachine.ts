import { isBuiltInEvent, isFunction, toSCXMLEvent } from './utils';
import type {
  Event,
  StateValue,
  MachineImplementations,
  EventObject,
  MachineConfig,
  SCXML,
  Transitions,
  MachineSchema,
  StateNodeDefinition,
  MachineContext,
  MaybeLazy,
  StateConfig
} from './types';
import { State } from './State';

import { IS_PRODUCTION } from './environment';
import { STATE_DELIMITER } from './constants';
import {
  getConfiguration,
  resolveMicroTransition,
  macrostep,
  toState,
  isStateId,
  getStateValue,
  getStateNodeByPath
} from './stateUtils';
import { getStateNodes, transitionNode, resolveStateValue } from './stateUtils';
import { StateNode } from './StateNode';

export const NULL_EVENT = '';
export const STATE_IDENTIFIER = '#';
export const WILDCARD = '*';

function createDefaultOptions<TContext extends MachineContext>(
  context: TContext
): MachineImplementations<TContext, any> {
  return {
    actions: {},
    guards: {},
    actors: {},
    delays: {},
    context
  };
}

function resolveContext<TContext>(
  context: TContext,
  partialContext?: MaybeLazy<Partial<TContext>>
): TContext {
  if (isFunction(partialContext)) {
    return { ...context, ...partialContext() };
  }

  return {
    ...context,
    ...partialContext
  };
}

export class StateMachine<
  TContext extends MachineContext = any,
  TEvent extends EventObject = EventObject
> {
  private _context: () => TContext;
  public get context(): TContext {
    return resolveContext(this._context(), this.options.context);
  }
  /**
   * The machine's own version.
   */
  public version?: string;

  public parent = undefined;
  public strict: boolean;

  /**
   * The string delimiter for serializing the path to a string. The default is "."
   */
  public delimiter: string;

  public options: MachineImplementations<TContext, TEvent>;

  public schema: MachineSchema<TContext, TEvent>;

  public __xstatenode: true = true;

  public idMap: Map<string, StateNode<TContext, TEvent>> = new Map();

  public root: StateNode<TContext, TEvent>;

  public key: string;

  public states: StateNode<TContext, TEvent>['states'];
  public events: Array<TEvent['type']>;

  constructor(
    /**
     * The raw config used to create the machine.
     */
    public config: MachineConfig<TContext, TEvent>,
    options?: Partial<MachineImplementations<TContext, TEvent>>
  ) {
    this.key = config.key || config.id || '(machine)';
    this.options = Object.assign(
      createDefaultOptions(config.context!),
      options
    );
    this._context = isFunction(config.context)
      ? config.context
      : () => config.context as TContext;
    // this.context = resolveContext(config.context, options?.context);
    this.delimiter = this.config.delimiter || STATE_DELIMITER;
    this.version = this.config.version;
    this.schema = this.config.schema ?? (({} as any) as this['schema']);
    this.strict = !!this.config.strict;
    this.transition = this.transition.bind(this);

    this.root = new StateNode(config, {
      _key: this.key,
      _machine: this
    });

    this.root._initialize();

    this.states = this.root.states; // TODO: remove!
    this.events = this.root.events;
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
    implementations: Partial<MachineImplementations<TContext, TEvent>>
  ): StateMachine<TContext, TEvent> {
    const { actions, guards, actors, delays } = this.options;

    return new StateMachine(this.config, {
      actions: { ...actions, ...implementations.actions },
      guards: { ...guards, ...implementations.guards },
      actors: { ...actors, ...implementations.actors },
      delays: { ...delays, ...implementations.delays },
      context: implementations.context
    });
  }

  /**
   * Clones this state machine with custom `context`.
   *
   * The `context` provided can be partial `context`, which will be combined with the original `context`.
   *
   * @param context Custom context (will override predefined context, not recursive)
   */
  public withContext(
    context: Partial<TContext>
  ): StateMachine<TContext, TEvent> {
    return this.provide({
      context
    });
  }

  /**
   * Resolves the given `state` to a new `State` instance relative to this machine.
   *
   * This ensures that `.nextEvents` represent the correct values.
   *
   * @param state The state to resolve
   */
  public resolveState(state: State<TContext, TEvent>): typeof state {
    const configuration = Array.from(
      getConfiguration(getStateNodes(this.root, state.value))
    );
    return this.createState({
      ...state,
      value: resolveStateValue(this.root, state.value),
      configuration
    });
  }

  /**
   * Determines the next state given the current `state` and received `event`.
   * Calculates a full macrostep from all microsteps.
   *
   * @param state The current State instance or state value
   * @param event The received event
   */
  public transition(
    state: StateValue | State<TContext, TEvent> = this.initialState,
    event: Event<TEvent> | SCXML.Event<TEvent>
  ): State<TContext, TEvent> {
    const currentState = toState(state, this);

    return macrostep(currentState, event, this);
  }

  /**
   * Determines the next state given the current `state` and `event`.
   * Calculates a microstep.
   *
   * @param state The current state
   * @param event The received event
   */
  public microstep(
    state: StateValue | State<TContext, TEvent> = this.initialState,
    event: Event<TEvent> | SCXML.Event<TEvent>
  ): State<TContext, TEvent> {
    const resolvedState = toState(state, this);
    const _event = toSCXMLEvent(event);

    if (!IS_PRODUCTION && _event.name === WILDCARD) {
      throw new Error(`An event cannot have the wildcard type ('${WILDCARD}')`);
    }

    if (this.strict) {
      if (
        !this.root.events.includes(_event.name) &&
        !isBuiltInEvent(_event.name)
      ) {
        throw new Error(
          `Machine '${this.key}' does not accept event '${_event.name}'`
        );
      }
    }

    const transitions = this.getTransitionData(resolvedState, _event);

    return resolveMicroTransition(this, transitions, resolvedState, _event);
  }

  public getTransitionData(
    state: State<TContext, TEvent>,
    _event: SCXML.Event<TEvent>
  ): Transitions<TContext, TEvent> {
    return transitionNode(this.root, state.value, state, _event) || [];
  }

  public get first(): State<TContext, TEvent> {
    const pseudoinitial = this.resolveState(
      State.from(
        getStateValue(this.root, getConfiguration([this.root])),
        this.context
      )
    );
    pseudoinitial._initial = true;

    return pseudoinitial;
  }

  /**
   * The initial State instance, which includes all actions to be executed from
   * entering the initial state.
   */
  public get initialState(): State<TContext, TEvent> {
    const nextState = resolveMicroTransition(this, [], this.first, undefined);
    return macrostep(nextState, null as any, this);
  }

  /**
   * Returns the initial `State` instance, with reference to `self` as an `ActorRef`.
   */
  public getInitialState(): State<TContext, TEvent> {
    const nextState = resolveMicroTransition(this, [], this.first, undefined);
    return macrostep(nextState, null as any, this) as State<TContext, TEvent>;
  }

  public getStateNodeById(stateId: string): StateNode<TContext, TEvent> {
    const fullPath = stateId.split(this.delimiter);
    const relativePath = fullPath.slice(1);
    const resolvedStateId = isStateId(fullPath[0])
      ? fullPath[0].slice(STATE_IDENTIFIER.length)
      : fullPath[0];

    const stateNode = this.idMap.get(resolvedStateId);
    if (!stateNode) {
      throw new Error(
        `Child state node '#${resolvedStateId}' does not exist on machine '${this.key}'`
      );
    }
    return getStateNodeByPath(stateNode, relativePath);
  }

  public get definition(): StateNodeDefinition<TContext, TEvent> {
    return this.root.definition;
  }

  public toJSON() {
    return this.definition;
  }

  public createState(
    stateConfig: State<TContext, TEvent> | StateConfig<TContext, TEvent>
  ): State<TContext, TEvent> {
    const state =
      stateConfig instanceof State
        ? stateConfig
        : (new State(stateConfig) as State<TContext, TEvent>);
    state.machine = this;
    return state;
  }
}
