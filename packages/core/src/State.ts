import isDevelopment from '#is-development';
import { STATE_DELIMITER } from './constants.ts';
import { memo } from './memo.ts';
import { MachineSnapshot } from './StateMachine.ts';
import type { StateNode } from './StateNode.ts';
import {
  getConfiguration,
  getStateNodes,
  getStateValue
} from './stateUtils.ts';
import { TypegenDisabled, TypegenEnabled } from './typegenTypes.ts';
import type {
  ProvidedActor,
  ActorRefFrom,
  AnyState,
  AnyStateMachine,
  EventObject,
  HistoryValue,
  MachineContext,
  PersistedMachineState,
  Prop,
  StateConfig,
  StateValue,
  TODO,
  AnyActorRef,
  Compute,
  EventDescriptor
} from './types.ts';
import { flatten, matchesState } from './utils.ts';

export interface StateTimer {
  delay: number;
  startedAt: number; // timestamp
  event: EventObject;
  target: AnyActorRef;
}

type ComputeConcreteChildren<TActor extends ProvidedActor> = {
  [A in TActor as 'id' extends keyof A
    ? A['id'] & string
    : never]?: ActorRefFrom<A['logic']>;
};

type ComputeChildren<TActor extends ProvidedActor> =
  // only proceed further if all configured `src`s are literal strings
  string extends TActor['src']
    ? // TODO: replace with UnknownActorRef~
      // TODO: consider adding `| undefined` here
      Record<string, AnyActorRef>
    : Compute<
        ComputeConcreteChildren<TActor> &
          // check if all actors have IDs
          (undefined extends TActor['id']
            ? // if they don't we need to create an index signature containing all possible actor types
              {
                [id: string]: TActor extends any
                  ? ActorRefFrom<TActor['logic']> | undefined
                  : never;
              }
            : {})
      >;

export function isStateConfig<
  TContext extends MachineContext,
  TEvent extends EventObject
>(state: any): state is StateConfig<TContext, TEvent> {
  if (typeof state !== 'object' || state === null) {
    return false;
  }

  return 'value' in state;
}

/**
 * @deprecated Use `isStateConfig(object)` or `state instanceof State` instead.
 */
export const isState = isStateConfig;
export class State<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TActor extends ProvidedActor,
  TTag extends string,
  TResolvedTypesMeta = TypegenDisabled
> {
  public tags: Set<string>;

  public value: StateValue;
  /**
   * Indicates whether the state is a final state.
   */
  public status: 'active' | 'done' | 'error' | 'stopped';
  /**
   * The output data of the top-level finite state.
   */
  public error: unknown;
  public context: TContext;
  public historyValue: Readonly<HistoryValue<TContext, TEvent>> = {};
  public _internalQueue: Array<TEvent>;
  /**
   * The enabled state nodes representative of the state value.
   */
  public configuration: Array<StateNode<TContext, TEvent>>;
  /**
   * An object mapping actor names to spawned/invoked actors.
   */
  public children: ComputeChildren<TActor>;

  public timers: StateTimer[] = [];

  /**
   * Creates a new State instance for the given `stateValue` and `context`.
   * @param stateValue
   * @param context
   */
  public static from<
    TContext extends MachineContext,
    TEvent extends EventObject = EventObject
  >(
    stateValue:
      | State<
          TContext,
          TEvent,
          TODO,
          any, // tags
          any // typegen
        >
      | StateValue,
    context: TContext = {} as TContext,
    machine: AnyStateMachine
  ): State<
    TContext,
    TEvent,
    TODO,
    any, // tags
    any // typegen
  > {
    if (stateValue instanceof State) {
      if (stateValue.context !== context) {
        return new State<TContext, TEvent, TODO, any, any>(
          {
            value: stateValue.value,
            context,
            meta: {},
            configuration: [], // TODO: fix,
            children: {},
            status: 'active'
          },
          machine
        );
      }

      return stateValue;
    }

    const configuration = getConfiguration(
      getStateNodes(machine.root, stateValue)
    );

    return new State<TContext, TEvent, TODO, any, any>(
      {
        value: stateValue,
        context,
        meta: undefined,
        configuration: Array.from(configuration),
        children: {},
        status: 'active'
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
    this.historyValue = config.historyValue || {};
    this.matches = this.matches.bind(this);
    this.toStrings = this.toStrings.bind(this);
    this.configuration =
      config.configuration ??
      Array.from(getConfiguration(getStateNodes(machine.root, config.value)));
    this.children = config.children as any;

    this.value = getStateValue(machine.root, this.configuration);
    this.tags = new Set(flatten(this.configuration.map((sn) => sn.tags)));
    this.status = config.status;
    (this as any).output = config.output;
    (this as any).error = config.error;
    this.timers = config.timers ?? [];
  }

  /**
   * Returns an array of all the string leaf state node paths.
   * @param stateValue
   * @param delimiter The character(s) that separate each subpath in the string state node path.
   */
  public toStrings(stateValue: StateValue = this.value): string[] {
    if (typeof stateValue === 'string') {
      return [stateValue];
    }
    const valueKeys = Object.keys(stateValue);

    return valueKeys.concat(
      ...valueKeys.map((key) =>
        this.toStrings(stateValue[key]).map((s) => key + STATE_DELIMITER + s)
      )
    );
  }

  public toJSON() {
    const { configuration, tags, machine, ...jsonValues } = this;

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
  public hasTag(tag: TTag): boolean {
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

    const transitionData = this.machine.getTransitionData(this as any, event);

    return (
      !!transitionData?.length &&
      // Check that at least one transition is not forbidden
      transitionData.some((t) => t.target !== undefined || t.actions.length)
    );
  }

  /**
   * The next events that will cause a transition from the current state.
   */
  public get nextEvents(): Array<EventDescriptor<TEvent>> {
    return memo(this, 'nextEvents', () => {
      return [
        ...new Set(flatten([...this.configuration.map((sn) => sn.ownEvents)]))
      ];
    });
  }

  public get meta(): Record<string, any> {
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

export function getPersistedState<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TActor extends ProvidedActor,
  TTag extends string,
  TOutput,
  TResolvedTypesMeta = TypegenDisabled
>(
  state: MachineSnapshot<
    TContext,
    TEvent,
    TActor,
    TTag,
    TOutput,
    TResolvedTypesMeta
  >
): PersistedMachineState<
  TContext,
  TEvent,
  TActor,
  TTag,
  TOutput,
  TResolvedTypesMeta
> {
  const { configuration, tags, machine, children, ...jsonValues } = state;

  const childrenJson: Partial<
    PersistedMachineState<
      TContext,
      TEvent,
      TActor,
      TTag,
      TOutput,
      TResolvedTypesMeta
    >['children']
  > = {};

  for (const id in children) {
    const child = children[id] as any;
    childrenJson[id as keyof typeof childrenJson] = {
      state: child.getPersistedState?.(),
      src: child.src
    };
  }

  return {
    ...jsonValues,
    children: childrenJson
  } as PersistedMachineState<
    TContext,
    TEvent,
    TActor,
    TTag,
    TOutput,
    TResolvedTypesMeta
  >;
}
