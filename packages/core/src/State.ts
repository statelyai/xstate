import { initEvent } from './actions';
import { IS_PRODUCTION } from './environment';
import { memo } from './memo';
import type { StateMachine } from './StateMachine';
import type { StateNode } from './StateNode';
import {
  getMeta,
  getTagsFromConfiguration,
  isInFinalState,
  nextEvents
} from './stateUtils';
import { TypegenDisabled, TypegenEnabled } from './typegenTypes';
import type {
  ActorRef,
  BaseActionObject,
  EventObject,
  HistoryValue,
  MachineContext,
  Prop,
  SCXML,
  SimpleEventsOf,
  StateConfig,
  StateValue,
  TransitionDefinition
} from './types';
import { isString, matchesState, toSCXMLEvent, warn } from './utils';

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
  public context: TContext;
  public historyValue: HistoryValue<TContext, TEvent> = {};
  public actions: BaseActionObject[] = [];
  public meta: any = {};
  public event: TEvent;
  public _internalQueue: Array<SCXML.Event<TEvent>> = [];
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
  public tags: Set<string>;
  public machine:
    | StateMachine<TContext, TEvent, BaseActionObject, any, TResolvedTypesMeta>
    | undefined;
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
    context: TContext = {} as TContext
  ): State<TContext, TEvent, any> {
    if (stateValue instanceof State) {
      if (stateValue.context !== context) {
        return new State<TContext, TEvent>({
          value: stateValue.value,
          context,
          _event: stateValue._event,
          _sessionid: undefined,
          actions: [],
          meta: {},
          configuration: [], // TODO: fix,
          transitions: [],
          children: {}
        });
      }

      return stateValue;
    }

    const _event = initEvent as SCXML.Event<TEvent>;

    return new State<TContext, TEvent>({
      value: stateValue,
      context,
      _event,
      _sessionid: undefined,
      actions: [],
      meta: undefined,
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
    TC extends MachineContext,
    TE extends EventObject = EventObject
  >(config: StateConfig<TC, TE>): State<TC, TE, any> {
    return new State(config);
  }
  /**
   * Creates a new `State` instance for the given `stateValue` and `context` with no actions (side-effects).
   * @param stateValue
   * @param context
   */
  public static inert<TState extends State<any, any, any>>(
    state: TState
  ): TState;
  public static inert<
    TContext extends MachineContext,
    TEvent extends EventObject = EventObject
  >(stateValue: StateValue, context: TContext): State<TContext, TEvent>;
  public static inert(
    stateValue: State<any, any, any> | StateValue,
    context?: MachineContext
  ): State<any, any, any> {
    if (stateValue instanceof State) {
      if (!stateValue.actions.length) {
        return stateValue;
      }
      const _event = initEvent as SCXML.Event<any>;

      return new State<any>({
        value: stateValue.value,
        context: stateValue.context,
        _event,
        _sessionid: undefined,
        configuration: stateValue.configuration,
        transitions: [],
        children: stateValue.children
      });
    }

    return State.from(stateValue, context);
  }

  /**
   * Creates a new `State` instance that represents the current state of a running machine.
   *
   * @param config
   */
  constructor(config: StateConfig<TContext, TEvent>) {
    this.value = config.value;
    this.context = config.context;
    this._event = config._event;
    this._sessionid = config._sessionid;
    this.event = this._event.data;
    this.historyValue = config.historyValue || {};
    this.actions = config.actions || [];
    this.meta = getMeta(config.configuration);
    this.matches = this.matches.bind(this);
    this.toStrings = this.toStrings.bind(this);
    this.configuration = config.configuration;
    this.transitions = config.transitions;
    this.children = config.children;
    this.tags = config.configuration
      ? getTagsFromConfiguration(config.configuration)
      : config.tags
      ? new Set(config.tags)
      : new Set();
    this.machine = config.machine;
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

    return { ...jsonValues, tags: Array.from(tags) };
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
   * Indicates whether the state is a final state.
   */
  public get done(): boolean {
    return isInFinalState(this.configuration);
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
  public can(event: TEvent | SimpleEventsOf<TEvent>['type']): boolean {
    if (IS_PRODUCTION) {
      warn(
        !!this.machine,
        `state.can(...) used outside of a machine-created State object; this will always return false.`
      );
    }

    const transitionData = this.machine?.getTransitionData(
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
    return memo(this, 'nextEvents', () => nextEvents(this.configuration));
  }
}
