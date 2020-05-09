import { toArray, isBuiltInEvent, toSCXMLEvent } from './utils';
import {
  Event,
  StateValue,
  MachineOptions,
  EventObject,
  StateSchema,
  MachineConfig,
  SCXML,
  Typestate,
  Transitions,
  ActorRef
} from './types';
import { State } from './State';

import { toActionObject } from './actions';
import { IS_PRODUCTION } from './environment';
import { STATE_DELIMITER } from './constants';
import {
  getConfiguration,
  getChildren,
  getAllStateNodes,
  resolveMicroTransition,
  macrostep,
  toState
} from './stateUtils';
import {
  getStateNodeById,
  getStateNodes,
  transitionNode,
  resolveStateValue
} from './stateUtils';
import { StateNode } from './StateNode';

export const NULL_EVENT = '';
export const STATE_IDENTIFIER = '#';
export const WILDCARD = '*';

const createDefaultOptions = <TContext>(
  context: TContext
): MachineOptions<TContext, any> => ({
  actions: {},
  guards: {},
  services: {},
  delays: {},
  context
});

function resolveContext<TContext>(
  context: TContext,
  partialContext?: Partial<TContext>
): TContext {
  if (context === undefined) {
    return context;
  }

  return {
    ...context,
    ...partialContext
  };
}

export class MachineNode<
  TContext = any,
  TStateSchema extends StateSchema = any,
  TEvent extends EventObject = EventObject,
  TTypestate extends Typestate<TContext> = any
> extends StateNode<TContext, TStateSchema, TEvent> {
  public context: TContext;
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

  public options: MachineOptions<TContext, TEvent>;

  public __xstatenode: true = true;

  constructor(
    /**
     * The raw config used to create the machine.
     */
    public config: MachineConfig<TContext, TStateSchema, TEvent>,
    options?: Partial<MachineOptions<TContext, TEvent>>
  ) {
    super(config, {
      _key: config.id || '(machine)'
    });
    this.options = Object.assign(
      createDefaultOptions(config.context!),
      options
    );
    this.context = resolveContext<TContext>(
      config.context as TContext,
      this.options.context
    );
    this.key = this.config.key || this.config.id || '(machine)';
    this.machine = this;
    this.path = [];
    this.delimiter = this.config.delimiter || STATE_DELIMITER;
    this.version = this.config.version;

    // Document order
    let order = 0;

    function dfs(stateNode: StateNode<TContext, any, TEvent>): void {
      stateNode.order = order++;

      for (const child of getChildren(stateNode)) {
        dfs(child);
      }
    }

    dfs(this);

    this.strict = !!this.config.strict;

    this.entry = toArray(this.config.entry).map((action) =>
      toActionObject(action)
    );

    this.exit = toArray(this.config.exit).map((action) =>
      toActionObject(action)
    );
    this.meta = this.config.meta;
    this.transition = this.transition.bind(this);
  }

  private _init(): void {
    if (this.__cache.transitions) {
      return;
    }
    getAllStateNodes(this).forEach((stateNode) => stateNode.on);
  }

  /**
   * Clones this state machine with custom options and context.
   *
   * @param options Options (actions, guards, services, delays) to recursively merge with the existing options.
   * @param context Custom context (will override predefined context)
   *
   * @returns A new `MachineNode` instance with the custom options and context
   */
  public withConfig(
    options: Partial<MachineOptions<TContext, TEvent>>
  ): MachineNode<TContext, TStateSchema, TEvent> {
    const { actions, guards, services, delays } = this.options;

    return new MachineNode(this.config, {
      actions: { ...actions, ...options.actions },
      guards: { ...guards, ...options.guards },
      services: { ...services, ...options.services },
      delays: { ...delays, ...options.delays },
      context: resolveContext(this.context, options.context)
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
  ): MachineNode<TContext, TStateSchema, TEvent> {
    return new MachineNode({
      ...this.config,
      context: resolveContext(this.context, context)
    });
  }

  /**
   * Resolves the given `state` to a new `State` instance relative to this machine.
   *
   * This ensures that `.nextEvents` represent the correct values.
   *
   * @param state The state to resolve
   */
  public resolveState(state: State<TContext, TEvent>): State<TContext, TEvent> {
    const configuration = Array.from(
      getConfiguration(getStateNodes(this, state.value))
    );
    return new State({
      ...state,
      value: resolveStateValue(this, state.value),
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
    event: Event<TEvent> | SCXML.Event<TEvent>,
    service?: ActorRef<TEvent>
  ): State<TContext, TEvent, TStateSchema, TTypestate> {
    const currentState = toState(state, this);

    return macrostep(currentState, event, this, service);
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
    event: Event<TEvent> | SCXML.Event<TEvent>,
    service?: ActorRef<TEvent>
  ): State<TContext, TEvent, TStateSchema, TTypestate> {
    const resolvedState = toState(state, this);
    const _event = toSCXMLEvent(event);

    if (!IS_PRODUCTION && _event.name === WILDCARD) {
      throw new Error(`An event cannot have the wildcard type ('${WILDCARD}')`);
    }

    if (this.strict) {
      if (!this.events.includes(_event.name) && !isBuiltInEvent(_event.name)) {
        throw new Error(
          `Machine '${this.id}' does not accept event '${_event.name}'`
        );
      }
    }

    const transitions: Transitions<TContext, TEvent> =
      transitionNode(this, resolvedState.value, resolvedState, _event) || [];

    return resolveMicroTransition(
      this,
      transitions,
      resolvedState,
      _event,
      service
    );
  }

  /**
   * The initial State instance, which includes all actions to be executed from
   * entering the initial state.
   */
  public get initialState(): State<TContext, TEvent, TStateSchema, TTypestate> {
    this._init();
    const nextState = resolveMicroTransition(this, [], undefined, undefined);
    return macrostep(nextState, null as any, this);
  }

  public getInitialState(service?: ActorRef<TEvent>) {
    this._init();
    const nextState = resolveMicroTransition(
      this,
      [],
      undefined,
      undefined,
      service
    );
    return macrostep(nextState, null as any, this);
  }

  public getStateNodeById(id: string): StateNode<TContext, any, TEvent> {
    return getStateNodeById(this, id);
  }
}
