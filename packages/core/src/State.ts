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
  ActionFunction
} from './types';
import { EMPTY_ACTIVITY_MAP } from './constants';
import { matchesState, keys, isString } from './utils';
import { StateNode } from './StateNode';
import { nextEvents } from './stateUtils';
import { initEvent } from './actions';
import { Actor } from './Actor';

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
  TTypestate extends Typestate<TContext> = {
    value: any;
    context: TContext;
  },
  TAction extends { type: string } = { type: string; [key: string]: any }
>(
  state: object | string
): state is State<TContext, TEvent, TStateSchema, TTypestate, TAction> {
  if (isString(state)) {
    return false;
  }

  return 'value' in state && 'history' in state;
}

export function bindActionToState<
  TC,
  TE extends EventObject,
  TA extends { type: string }
>(
  action: ActionObject<TC, TE, TA>,
  state: State<TC, TE, any, any, TA>
): ActionObject<TC, TE, TA> {
  const boundAction = {
    ...action,
    exec:
      'exec' in action
        ? () => {
            const refinedAction = action as {
              exec: ActionFunction<TC, TE, TA>;
            };
            return refinedAction.exec(state.context, state.event as TE, {
              action,
              state,
              _event: state._event
            });
          }
        : undefined
  } as any;

  return boundAction;
}

export class State<
  TContext,
  TEvent extends EventObject = EventObject,
  TStateSchema extends StateSchema<TContext> = any,
  TTypestate extends Typestate<TContext> = {
    value: any;
    context: TContext;
  },
  TAction extends { type: string } = { type: string; [key: string]: any }
> {
  public value: StateValue;
  public context: TContext;
  public historyValue?: HistoryValue | undefined;
  public history?: State<TContext, TEvent, TStateSchema, TTypestate, TAction>;
  public actions: Array<ActionObject<TContext, TEvent, TAction>> = [];
  public activities: ActivityMap = EMPTY_ACTIVITY_MAP;
  public meta: any = {};
  public events: TEvent[] = [];
  public event: TEvent;
  public _event: SCXML.Event<TEvent>;
  public _sessionid: string | null;
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
  public configuration: Array<StateNode<TContext, any, TEvent, any, TAction>>;
  /**
   * The next events that will cause a transition from the current state.
   */
  // @ts-ignore - getter for this gets configured in constructor so this property can stay non-enumerable
  public nextEvents: EventType[];
  /**
   * The transition definitions that resulted in this state.
   */
  public transitions: Array<TransitionDefinition<TContext, TEvent, TAction>>;
  /**
   * An object mapping actor IDs to spawned actors/invoked services.
   */
  public children: Record<string, Actor>;
  /**
   * Creates a new State instance for the given `stateValue` and `context`.
   * @param stateValue
   * @param context
   */
  public static from<
    TC,
    TE extends EventObject = EventObject,
    TA extends { type: string } = { type: string; [key: string]: any }
  >(
    stateValue: State<TC, TE, any, any, TA> | StateValue,
    context?: TC | undefined
  ): State<TC, TE, any, any, TA> {
    if (stateValue instanceof State) {
      if (stateValue.context !== context) {
        return new State<TC, TE, any, any, TA>({
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
          children: {}
        });
      }

      return stateValue;
    }

    const _event = initEvent as SCXML.Event<TE>;

    return new State<TC, TE, any, any, TA>({
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
      children: {}
    });
  }
  /**
   * Creates a new State instance for the given `config`.
   * @param config The state config
   */
  public static create<
    TC,
    TE extends EventObject = EventObject,
    TA extends { type: string } = { type: string; [key: string]: any }
  >(config: StateConfig<TC, TE, TA>): State<TC, TE, any, any, TA> {
    return new State(config);
  }
  /**
   * Creates a new `State` instance for the given `stateValue` and `context` with no actions (side-effects).
   * @param stateValue
   * @param context
   */
  public static inert<
    TC,
    TE extends EventObject = EventObject,
    TA extends { type: string } = { type: string; [key: string]: any }
  >(
    stateValue: State<TC, TE, any, any, TA> | StateValue,
    context: TC
  ): State<TC, TE, any, any, TA> {
    if (stateValue instanceof State) {
      if (!stateValue.actions.length) {
        return stateValue as State<TC, TE, any, any, TA>;
      }
      const _event = initEvent as SCXML.Event<TE>;

      return new State<TC, TE, any, any, TA>({
        value: stateValue.value,
        context,
        _event,
        _sessionid: null,
        historyValue: stateValue.historyValue,
        history: stateValue.history,
        activities: stateValue.activities,
        configuration: stateValue.configuration,
        transitions: [],
        children: {}
      });
    }

    return State.from<TC, TE, TA>(stateValue, context);
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
  constructor(config: StateConfig<TContext, TEvent, TAction>) {
    this.value = config.value;
    this.context = config.context;
    this._event = config._event;
    this._sessionid = config._sessionid;
    this.event = this._event.data;
    this.historyValue = config.historyValue;
    this.history = config.history as this;
    this.actions = config.actions || [];
    this.activities = config.activities || EMPTY_ACTIVITY_MAP;
    this.meta = config.meta || {};
    this.events = config.events || [];
    this.matches = this.matches.bind(this);
    this.toStrings = this.toStrings.bind(this);
    this.configuration = config.configuration;
    this.transitions = config.transitions;
    this.children = config.children;
    this.done = !!config.done;

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
    const { configuration, transitions, ...jsonValues } = this;

    return jsonValues;
  }

  /**
   * Whether the current state value is a subset of the given parent state value.
   * @param parentStateValue
   */
  public matches<TSV extends TTypestate['value']>(
    parentStateValue: TSV
  ): this is State<
    (TTypestate extends { value: TSV } ? TTypestate : never)['context'],
    TEvent,
    TStateSchema,
    TTypestate
  > & { value: TSV } {
    return matchesState(parentStateValue as StateValue, this.value);
  }
}
