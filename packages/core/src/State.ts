import isDevelopment from '#is-development';
import { createInitEvent } from './actions.ts';
import { memo } from './memo.ts';
import type { StateNode } from './StateNode.ts';
import {
  getConfiguration,
  getStateNodes,
  getStateValue
} from './stateUtils.ts';
import { TypegenDisabled, TypegenEnabled } from './typegenTypes.ts';
import type {
  ActorImpl,
  ActorRef,
  ActorRefFrom,
  AnyActorLogic,
  AnyState,
  AnyStateMachine,
  BaseActionObject,
  EventObject,
  HistoryValue,
  MachineContext,
  ParameterizedObject,
  PersistedMachineState,
  Prop,
  StateConfig,
  StateValue,
  TODO,
  TransitionDefinition,
  WithDefault
} from './types.ts';
import { flatten, isString, matchesState } from './utils.ts';

export function isStateConfig<
  TContext extends MachineContext,
  TEvent extends EventObject
>(state: any): state is StateConfig<TContext, TEvent> {
  if (typeof state !== 'object' || state === null) {
    return false;
  }

  return 'value' in state && 'event' in state;
}

/**
 * @deprecated Use `isStateConfig(object)` or `state instanceof State` instead.
 */
export const isState = isStateConfig;
export class State<
  TContext extends MachineContext,
  TEvent extends EventObject,
  _TActions extends ParameterizedObject,
  TActors extends ActorImpl,
  TResolvedTypesMeta = TypegenDisabled
> {
  public tags: Set<string>;

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
  public _internalQueue: Array<TEvent>;
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
  public children: TActors['id'] extends string
    ? {
        [K in TActors['id']]: TActors extends { id: K }
          ? ActorRefFrom<WithDefault<TActors['logic'], AnyActorLogic>>
          : never;
      }
    : Record<string, ActorRef<any>>;

  /**
   * Creates a new State instance for the given `stateValue` and `context`.
   * @param stateValue
   * @param context
   */
  public static from<
    TContext extends MachineContext,
    TEvent extends EventObject = EventObject
  >(
    stateValue: State<TContext, TEvent, TODO, TODO, any> | StateValue,
    context: TContext = {} as TContext,
    machine: AnyStateMachine
  ): State<TContext, TEvent, TODO, TODO, any> {
    if (stateValue instanceof State) {
      if (stateValue.context !== context) {
        return new State<TContext, TEvent, TODO, TODO, any>(
          {
            value: stateValue.value,
            context,
            event: stateValue.event,
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

    const event = createInitEvent({}) as unknown as TEvent; // TODO: fix

    const configuration = getConfiguration(
      getStateNodes(machine.root, stateValue)
    );

    return new State<TContext, TEvent, TODO, TODO, any>(
      {
        value: stateValue,
        context,
        event,
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
    this._internalQueue = config._internalQueue ?? [];
    this.event = config.event;
    this.historyValue = config.historyValue || {};
    this.actions = config.actions ?? [];
    this.matches = this.matches.bind(this);
    this.toStrings = this.toStrings.bind(this);
    this.configuration =
      config.configuration ??
      Array.from(getConfiguration(getStateNodes(machine.root, config.value)));
    this.transitions = config.transitions as any;
    this.children = config.children as any;

    this.value = getStateValue(machine.root, this.configuration);
    this.tags = new Set(flatten(this.configuration.map((sn) => sn.tags)));
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
    if (isDevelopment && !this.machine) {
      console.warn(
        `state.can(...) used outside of a machine-created State object; this will always return false.`
      );
    }

    const transitionData = this.machine.getTransitionData(this, event);

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
  const { configuration, transitions, tags, machine, children, ...jsonValues } =
    state;

  const childrenJson: Partial<PersistedMachineState<any>['children']> = {};

  for (const id in children) {
    childrenJson[id] = {
      state: children[id].getPersistedState?.(),
      src: children[id].src
    };
  }

  return {
    ...jsonValues,
    children: childrenJson
  } as PersistedMachineState<TState>;
}
