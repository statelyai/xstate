import { createInitEvent } from './actions.js';
import { IS_PRODUCTION } from './environment.js';
import { memo } from './memo.js';
import type { StateNode } from './StateNode.js';
import {
  getConfiguration,
  getStateNodes,
  getStateValue
} from './stateUtils.js';
import { TypegenDisabled, TypegenEnabled } from './typegenTypes.js';
import type {
  ActorRef,
  AnyState,
  AnyStateMachine,
  BaseActionObject,
  EventObject,
  HistoryValue,
  MachineContext,
  PersistedMachineState,
  Prop,
  SCXML,
  StateConfig,
  StateValue,
  TransitionDefinition
} from './types.js';
import {
  flatten,
  isString,
  matchesState,
  toSCXMLEvent,
  warn
} from './utils.js';

export function isStateConfig<
  TContext extends MachineContext,
  TEvent extends EventObject
>(state: any): state is StateConfig<TContext, TEvent> {
  if (typeof state !== 'object' || state === null) {
    return false;
  }

  return 'value' in state && '_event' in state;
}

/**
 * @deprecated Use `isStateConfig(object)` or `state instanceof State` instead.
 */
export const isState = isStateConfig;
export class State<
  TContext extends MachineContext,
  TEvent extends EventObject = EventObject,
  TResolvedTypesMeta = TypegenDisabled
> {
  public value: StateValue;
  /**
   * Indicates whether the state is a final state.
   */
  public done: boolean;
  /**
   * The done data of the top-level finite state.
   */
  public output: any; // TODO: add an explicit type for `output`
  public context: TContext;
  public historyValue: Readonly<HistoryValue<TContext, TEvent>> = {};
  public actions: BaseActionObject[] = [];
  public event: TEvent;
  public _internalQueue: Array<SCXML.Event<TEvent>>;
  public _event: SCXML.Event<TEvent>;
  public _sessionid: string | undefined;
  public _initial: boolean = false;
  /**
   * Indicates whether the state has changed from the previous state. A state is considered "changed" if:
   *
   * - Its value is not equal to its previous value, or:
   * - It has any new actions (side-effects) to execute.
   *
   * An initial state (with no history) will return `undefined`.
   */
  public changed: boolean | undefined;
  /**
   * The enabled state nodes representative of the state value.
   */
  public configuration: Array<StateNode<TContext, TEvent>>;
  /**
   * The transition definitions that resulted in this state.
   */
  public transitions: Array<TransitionDefinition<TContext, TEvent>>;
  /**
   * An object mapping actor names to spawned/invoked actors.
   */
  public children: Record<string, ActorRef<any>>;
  /**
   * Creates a new State instance for the given `stateValue` and `context`.
   * @param stateValue
   * @param context
   */
  public static from<
    TContext extends MachineContext,
    TEvent extends EventObject = EventObject
  >(
    stateValue: State<TContext, TEvent, any> | StateValue,
    context: TContext = {} as TContext,
    machine: AnyStateMachine
  ): State<TContext, TEvent, any> {
    if (stateValue instanceof State) {
      if (stateValue.context !== context) {
        return new State<TContext, TEvent>(
          {
            value: stateValue.value,
            context,
            _event: stateValue._event,
            _sessionid: undefined,
            actions: [],
            meta: {},
            configuration: [], // TODO: fix,
            transitions: [],
            children: {}
          },
          machine
        );
      }

      return stateValue;
    }

    const _event = (createInitEvent({}) as unknown) as SCXML.Event<TEvent>; // TODO: fix

    const configuration = getConfiguration(
      getStateNodes(machine.root, stateValue)
    );

    return new State<TContext, TEvent>(
      {
        value: stateValue,
        context,
        _event,
        _sessionid: undefined,
        actions: [],
        meta: undefined,
        configuration: Array.from(configuration),
        transitions: [],
        children: {}
      },
      machine
    );
  }

  /**
   * Creates a new `State` instance that represents the current state of a running machine.
   *
   * @param config
   */
  constructor(
    config: StateConfig<TContext, TEvent>,
    public machine: AnyStateMachine
  ) {
    this.context = config.context;
    this._event = config._event;
    this._sessionid = config._sessionid;
    this._internalQueue = config._internalQueue ?? [];
    this.event = this._event.data;
    this.historyValue = config.historyValue || {};
    this.actions = config.actions ?? [];
    this.matches = this.matches.bind(this);
    this.toStrings = this.toStrings.bind(this);
    this.configuration =
      config.configuration ??
      Array.from(getConfiguration(getStateNodes(machine.root, config.value)));
    this.transitions = config.transitions;
    this.children = config.children;

    this.value = getStateValue(machine.root, this.configuration);
    this.done = config.done ?? false;
    this.output = config.output;
  }

  /**
   * Returns an array of all the string leaf state node paths.
   * @param stateValue
   * @param delimiter The character(s) that separate each subpath in the string state node path.
   */
  public toStrings(
    stateValue: StateValue = this.value,
    delimiter: string = '.'
  ): string[] {
    if (isString(stateValue)) {
      return [stateValue];
    }
    const valueKeys = Object.keys(stateValue);

    return valueKeys.concat(
      ...valueKeys.map((key) =>
        this.toStrings(stateValue[key], delimiter).map(
          (s) => key + delimiter + s
        )
      )
    );
  }

  public toJSON() {
    const { configuration, transitions, tags, machine, ...jsonValues } = this;

    return { ...jsonValues, tags: Array.from(tags), meta: this.meta };
  }

  /**
   * Whether the current state value is a subset of the given parent state value.
   * @param parentStateValue
   */
  public matches<
    TSV extends TResolvedTypesMeta extends TypegenEnabled
      ? Prop<Prop<TResolvedTypesMeta, 'resolved'>, 'matchesStates'>
      : StateValue
  >(parentStateValue: TSV): boolean {
    return matchesState(parentStateValue as any, this.value);
  }

  /**
   * Whether the current state configuration has a state node with the specified `tag`.
   * @param tag
   */
  public hasTag(
    tag: TResolvedTypesMeta extends TypegenEnabled
      ? Prop<Prop<TResolvedTypesMeta, 'resolved'>, 'tags'>
      : string
  ): boolean {
    return this.tags.has(tag as string);
  }

  /**
   * Determines whether sending the `event` will cause a non-forbidden transition
   * to be selected, even if the transitions have no actions nor
   * change the state value.
   *
   * @param event The event to test
   * @returns Whether the event will cause a transition
   */
  public can(event: TEvent): boolean {
    if (IS_PRODUCTION) {
      warn(
        !!this.machine,
        `state.can(...) used outside of a machine-created State object; this will always return false.`
      );
    }

    const transitionData = this.machine.getTransitionData(
      this,
      toSCXMLEvent(event)
    );

    return (
      !!transitionData?.length &&
      // Check that at least one transition is not forbidden
      transitionData.some((t) => t.target !== undefined || t.actions.length)
    );
  }

  /**
   * The next events that will cause a transition from the current state.
   */
  public get nextEvents(): Array<TEvent['type']> {
    return memo(this, 'nextEvents', () => {
      return [
        ...new Set(flatten([...this.configuration.map((sn) => sn.ownEvents)]))
      ];
    });
  }

  public get meta() {
    return this.configuration.reduce((acc, stateNode) => {
      if (stateNode.meta !== undefined) {
        acc[stateNode.id] = stateNode.meta;
      }
      return acc;
    }, {} as Record<string, any>);
  }

  public get tags(): Set<string> {
    return new Set(flatten(this.configuration.map((sn) => sn.tags)));
  }
}

export function cloneState<TState extends AnyState>(
  state: TState,
  config: Partial<StateConfig<any, any>> = {}
): TState {
  return new State(
    { ...state, ...config } as StateConfig<any, any>,
    state.machine
  ) as TState;
}

export function getPersistedState<TState extends AnyState>(
  state: TState
): PersistedMachineState<TState> {
  const {
    configuration,
    transitions,
    tags,
    machine,
    children,
    ...jsonValues
  } = state;

  const childrenJson: any = {};

  for (const key in children) {
    childrenJson[key] = children[key].getPersistedState?.();
  }

  return {
    ...jsonValues,
    children: childrenJson,
    persisted: true
  };
}
