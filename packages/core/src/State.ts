import {
  StateValue,
  ActivityMap,
  EventObject,
  HistoryValue,
  ActionObject,
  EventType,
  StateValueMap,
  StateConfig,
  SCXML,
  StateSchema,
  TransitionDefinition,
  Typestate,
  ActorRef,
  StateMachine,
  SimpleEventsOf
} from './types';
import { EMPTY_ACTIVITY_MAP } from './constants';
import { matchesState, keys, isString, warn } from './utils';
import { StateNode } from './StateNode';
import { getMeta, nextEvents } from './stateUtils';
import { initEvent } from './actions';
import { IS_PRODUCTION } from './environment';
import { ExtraGenerics } from '.';

export function stateValuesEqual(
  a: StateValue | undefined,
  b: StateValue | undefined
): boolean {
  if (a === b) {
    return true;
  }

  if (a === undefined || b === undefined) {
    return false;
  }

  if (isString(a) || isString(b)) {
    return a === b;
  }

  const aKeys = keys(a as StateValueMap);
  const bKeys = keys(b as StateValueMap);

  return (
    aKeys.length === bKeys.length &&
    aKeys.every((key) => stateValuesEqual(a[key], b[key]))
  );
}

export function isState<
  TContext,
  TEvent extends EventObject,
  TStateSchema extends StateSchema<TContext> = any,
  TTypestate extends Typestate<TContext> = { value: any; context: TContext },
  TExtra extends ExtraGenerics = {}
>(
  state: object | string
): state is State<TContext, TEvent, TStateSchema, TTypestate, TExtra> {
  if (isString(state)) {
    return false;
  }

  return 'value' in state && 'history' in state;
}

export function bindActionToState<
  TC,
  TE extends EventObject,
  TExtra extends ExtraGenerics
>(
  action: ActionObject<TC, TE, TExtra>,
  state: State<TC, TE, any, any, TExtra>
): ActionObject<TC, TE, TExtra> {
  const { exec } = action;
  const boundAction: ActionObject<TC, TE, TExtra> = {
    ...action,
    exec:
      exec !== undefined
        ? () =>
            exec(state.context, state.event as TE, {
              action,
              state,
              _event: state._event
            })
        : undefined
  };

  return boundAction;
}

export class State<
  TContext,
  TEvent extends EventObject = EventObject,
  TStateSchema extends StateSchema<TContext> = any,
  TTypestate extends Typestate<TContext> = { value: any; context: TContext },
  TExtra extends ExtraGenerics = {}
> {
  public value: StateValue;
  public context: TContext;
  public historyValue?: HistoryValue | undefined;
  public history?: State<TContext, TEvent, TStateSchema, TTypestate, TExtra>;
  public actions: Array<ActionObject<TContext, TEvent, TExtra>> = [];
  public activities: ActivityMap = EMPTY_ACTIVITY_MAP;
  public meta: any = {};
  public events: TEvent[] = [];
  public event: TEvent;
  public _event: SCXML.Event<TEvent>;
  public _sessionid: string | null;
  public input: NonNullable<TExtra['input']>;
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
   * Indicates whether the state is a final state.
   */
  public done: boolean | undefined;
  /**
   * The enabled state nodes representative of the state value.
   */
  public configuration: Array<StateNode<TContext, any, TEvent, any>>;
  /**
   * The next events that will cause a transition from the current state.
   */
  // @ts-ignore - getter for this gets configured in constructor so this property can stay non-enumerable
  public nextEvents: EventType[];
  /**
   * The transition definitions that resulted in this state.
   */
  public transitions: Array<TransitionDefinition<TContext, TEvent, TExtra>>;
  /**
   * An object mapping actor IDs to spawned actors/invoked services.
   */
  public children: Record<string, ActorRef<any>>;
  public tags: Set<string>;
  public machine: StateMachine<TContext, any, TEvent, TTypestate> | undefined;
  /**
   * Creates a new State instance for the given `stateValue` and `context`.
   * @param stateValue
   * @param context
   */
  public static from<
    TC,
    TE extends EventObject = EventObject,
    TExtra extends ExtraGenerics = {}
  >(
    stateValue: State<TC, TE, any, any, TExtra> | StateValue,
    context?: TC | undefined
  ): State<TC, TE, any, any, TExtra> {
    if (stateValue instanceof State) {
      if (stateValue.context !== context) {
        return new State<TC, TE, any, any, TExtra>({
          value: stateValue.value,
          context: context as TC,
          _event: stateValue._event,
          _sessionid: null,
          historyValue: stateValue.historyValue,
          history: stateValue.history,
          actions: [],
          activities: stateValue.activities,
          meta: {},
          events: [],
          configuration: [], // TODO: fix,
          transitions: [],
          children: {},
          input: stateValue.input
        });
      }

      return stateValue;
    }

    const _event = initEvent as SCXML.Event<TE>;

    return new State<TC, TE, any, any, TExtra>({
      value: stateValue,
      context: context as TC,
      _event,
      _sessionid: null,
      historyValue: undefined,
      history: undefined,
      actions: [],
      activities: undefined,
      meta: undefined,
      events: [],
      configuration: [],
      transitions: [],
      children: {},
      input: {} as NonNullable<TExtra['input']>
    });
  }
  /**
   * Creates a new State instance for the given `config`.
   * @param config The state config
   */
  public static create<TC, TE extends EventObject = EventObject, TExtra = {}>(
    config: StateConfig<TC, TE, TExtra>
  ): State<TC, TE> {
    return new State(config);
  }
  /**
   * Creates a new `State` instance for the given `stateValue` and `context` with no actions (side-effects).
   * @param stateValue
   * @param context
   */
  public static inert<TC, TE extends EventObject = EventObject>(
    stateValue: State<TC, TE> | StateValue,
    context: TC
  ): State<TC, TE> {
    if (stateValue instanceof State) {
      if (!stateValue.actions.length) {
        return stateValue as State<TC, TE>;
      }
      const _event = initEvent as SCXML.Event<TE>;

      return new State<TC, TE>({
        value: stateValue.value,
        context,
        _event,
        _sessionid: null,
        historyValue: stateValue.historyValue,
        history: stateValue.history,
        activities: stateValue.activities,
        configuration: stateValue.configuration,
        transitions: [],
        children: {},
        input: {}
      });
    }

    return State.from<TC, TE>(stateValue, context);
  }

  /**
   * Creates a new State instance.
   * @param value The state value
   * @param context The extended state
   * @param historyValue The tree representing historical values of the state nodes
   * @param history The previous state
   * @param actions An array of action objects to execute as side-effects
   * @param activities A mapping of activities and whether they are started (`true`) or stopped (`false`).
   * @param meta
   * @param events Internal event queue. Should be empty with run-to-completion semantics.
   * @param configuration
   */
  constructor(config: StateConfig<TContext, TEvent, TExtra>) {
    this.value = config.value;
    this.context = config.context;
    this._event = config._event;
    this._sessionid = config._sessionid;
    this.event = this._event.data;
    this.historyValue = config.historyValue;
    this.history = config.history as this;
    this.actions = config.actions || [];
    this.activities = config.activities || EMPTY_ACTIVITY_MAP;
    this.meta = getMeta(config.configuration);
    this.events = config.events || [];
    this.matches = this.matches.bind(this);
    this.toStrings = this.toStrings.bind(this);
    this.configuration = config.configuration;
    this.transitions = config.transitions;
    this.children = config.children;
    this.done = !!config.done;
    this.tags =
      (Array.isArray(config.tags) ? new Set(config.tags) : config.tags) ??
      new Set();
    this.machine = config.machine;
    this.input =
      config.input ||
      // Add a default in case there are mismatched XState versions
      ({} as NonNullable<TExtra['input']>);

    Object.defineProperty(this, 'nextEvents', {
      get: () => {
        return nextEvents(this.configuration);
      }
    });
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
    const valueKeys = keys(stateValue);

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

    return { ...jsonValues, tags: Array.from(tags) };
  }

  /**
   * Whether the current state value is a subset of the given parent state value.
   * @param parentStateValue
   */
  public matches<TSV extends TTypestate['value']>(
    parentStateValue: TSV
  ): this is State<
    (TTypestate extends any
      ? { value: TSV; context: any } extends TTypestate
        ? TTypestate
        : never
      : never)['context'],
    TEvent,
    TStateSchema,
    TTypestate,
    TExtra
  > & { value: TSV } {
    return matchesState(parentStateValue as StateValue, this.value);
  }

  /**
   * Whether the current state configuration has a state node with the specified `tag`.
   * @param tag
   */
  public hasTag(tag: string): boolean {
    return this.tags.has(tag);
  }

  /**
   * Determines whether sending the `event` will cause a transition.
   * @param event The event to test
   * @returns Whether the event will cause a transition
   */
  public can(event: TEvent | SimpleEventsOf<TEvent>['type']): boolean {
    if (IS_PRODUCTION) {
      warn(
        !!this.machine,
        `state.can(...) used outside of a machine-created State object; this will always return false.`
      );
    }

    const transitionData = this.machine?.getTransitionData(this, event);

    /**
     * The state will change from this event if:
     * - There are entry actions
     * - There are exit actions
     * - There are transitions in which either the target has changed or there are transition actions
     */
    return !transitionData
      ? false
      : transitionData.entrySet.some((sn) => sn.onEntry.length > 0) ||
          transitionData.exitSet.some((sn) => sn.onExit.length > 0) ||
          !!transitionData?.transitions.some((t) => {
            return (
              (t.target && t.target.length > 0 && t.target[0] !== t.source) ||
              t.actions.length > 0
            );
          });
  }
}
