import isDevelopment from '#is-development';
import { $$ACTOR_TYPE } from './interpreter.ts';
import { memo } from './memo.ts';
import type { StateNode } from './StateNode.ts';
import type { StateMachine } from './StateMachine.ts';
import { getStateValue } from './stateUtils.ts';
import { TypegenDisabled, TypegenEnabled } from './typegenTypes.ts';
import type {
  ProvidedActor,
  ActorRefFrom,
  AnyMachineSnapshot,
  AnyStateMachine,
  EventObject,
  HistoryValue,
  MachineContext,
  Prop,
  StateConfig,
  StateValue,
  AnyActorRef,
  Compute,
  EventDescriptor,
  Snapshot,
  ParameterizedObject
} from './types.ts';
import { flatten, matchesState } from './utils.ts';

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

export function isMachineSnapshot<
  TContext extends MachineContext,
  TEvent extends EventObject
>(value: unknown): value is AnyMachineSnapshot {
  return (
    !!value &&
    typeof value === 'object' &&
    'machine' in value &&
    'value' in value
  );
}

interface MachineSnapshotBase<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TActor extends ProvidedActor,
  TTag extends string,
  TOutput,
  TResolvedTypesMeta = TypegenDisabled
> {
  machine: StateMachine<
    TContext,
    TEvent,
    TActor,
    ParameterizedObject,
    ParameterizedObject,
    string,
    TTag,
    unknown,
    TOutput,
    TResolvedTypesMeta
  >;
  tags: Set<string>;
  value: StateValue;
  status: 'active' | 'done' | 'error' | 'stopped';
  error: unknown;
  context: TContext;

  historyValue: Readonly<HistoryValue<TContext, TEvent>>;
  /**
   * The enabled state nodes representative of the state value.
   */
  configuration: Array<StateNode<TContext, TEvent>>;
  /**
   * An object mapping actor names to spawned/invoked actors.
   */
  children: ComputeChildren<TActor>;

  /**
   * The next events that will cause a transition from the current state.
   */
  nextEvents: Array<EventDescriptor<TEvent>>;

  meta: Record<string, any>;

  /**
   * Whether the current state value is a subset of the given parent state value.
   * @param parentStateValue
   */
  matches: <
    TSV extends TResolvedTypesMeta extends TypegenEnabled
      ? Prop<Prop<TResolvedTypesMeta, 'resolved'>, 'matchesStates'>
      : StateValue
  >(
    parentStateValue: TSV
  ) => boolean;

  /**
   * Whether the current state configuration has a state node with the specified `tag`.
   * @param tag
   */
  hasTag: (tag: TTag) => boolean;

  /**
   * Determines whether sending the `event` will cause a non-forbidden transition
   * to be selected, even if the transitions have no actions nor
   * change the state value.
   *
   * @param event The event to test
   * @returns Whether the event will cause a transition
   */
  can: (event: TEvent) => boolean;

  toJSON: () => unknown;
}

interface ActiveMachineSnapshot<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TActor extends ProvidedActor,
  TTag extends string,
  TOutput,
  TResolvedTypesMeta = TypegenDisabled
> extends MachineSnapshotBase<
    TContext,
    TEvent,
    TActor,
    TTag,
    TOutput,
    TResolvedTypesMeta
  > {
  status: 'active';
  output: undefined;
  error: undefined;
}

interface DoneMachineSnapshot<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TActor extends ProvidedActor,
  TTag extends string,
  TOutput,
  TResolvedTypesMeta = TypegenDisabled
> extends MachineSnapshotBase<
    TContext,
    TEvent,
    TActor,
    TTag,
    TOutput,
    TResolvedTypesMeta
  > {
  status: 'done';
  output: TOutput;
  error: undefined;
}

interface ErrorMachineSnapshot<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TActor extends ProvidedActor,
  TTag extends string,
  TOutput,
  TResolvedTypesMeta = TypegenDisabled
> extends MachineSnapshotBase<
    TContext,
    TEvent,
    TActor,
    TTag,
    TOutput,
    TResolvedTypesMeta
  > {
  status: 'error';
  output: undefined;
  error: unknown;
}

interface StoppedMachineSnapshot<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TActor extends ProvidedActor,
  TTag extends string,
  TOutput,
  TResolvedTypesMeta = TypegenDisabled
> extends MachineSnapshotBase<
    TContext,
    TEvent,
    TActor,
    TTag,
    TOutput,
    TResolvedTypesMeta
  > {
  status: 'stopped';
  output: undefined;
  error: undefined;
}

export type MachineSnapshot<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TActor extends ProvidedActor,
  TTag extends string,
  TOutput,
  TResolvedTypesMeta = TypegenDisabled
> =
  | ActiveMachineSnapshot<
      TContext,
      TEvent,
      TActor,
      TTag,
      TOutput,
      TResolvedTypesMeta
    >
  | DoneMachineSnapshot<
      TContext,
      TEvent,
      TActor,
      TTag,
      TOutput,
      TResolvedTypesMeta
    >
  | ErrorMachineSnapshot<
      TContext,
      TEvent,
      TActor,
      TTag,
      TOutput,
      TResolvedTypesMeta
    >
  | StoppedMachineSnapshot<
      TContext,
      TEvent,
      TActor,
      TTag,
      TOutput,
      TResolvedTypesMeta
    >;

export function createMachineSnapshot<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TActor extends ProvidedActor,
  TTag extends string,
  TResolvedTypesMeta = TypegenDisabled
>(
  config: StateConfig<TContext, TEvent>,
  machine: AnyStateMachine
): MachineSnapshot<
  TContext,
  TEvent,
  TActor,
  TTag,
  undefined,
  TResolvedTypesMeta
> {
  return {
    status: config.status as any,
    output: config.output,
    error: config.error,
    machine,
    context: config.context,
    configuration: config.configuration,
    value: getStateValue(machine.root, config.configuration),
    tags: new Set(flatten(config.configuration.map((sn) => sn.tags))),
    children: config.children as any,
    historyValue: config.historyValue || {},
    matches(parentStateValue) {
      return matchesState(parentStateValue as any, this.value);
    },
    hasTag(tag) {
      return this.tags.has(tag);
    },
    can(event) {
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
    },
    get nextEvents() {
      return memo(this, 'nextEvents', () => {
        return [
          ...new Set(flatten([...this.configuration.map((sn) => sn.ownEvents)]))
        ];
      });
    },
    get meta() {
      return this.configuration.reduce((acc, stateNode) => {
        if (stateNode.meta !== undefined) {
          acc[stateNode.id] = stateNode.meta;
        }
        return acc;
      }, {} as Record<string, any>);
    },
    toJSON() {
      const {
        configuration,
        tags,
        machine,
        nextEvents,
        toJSON,
        can,
        hasTag,
        matches,
        ...jsonValues
      } = this;
      return { ...jsonValues, tags: Array.from(tags) };
    }
  };
}

export function cloneMachineSnapshot<TState extends AnyMachineSnapshot>(
  state: TState,
  config: Partial<StateConfig<any, any>> = {}
): TState {
  return createMachineSnapshot(
    // TODO: it's wasteful that this spread triggers getters
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
  >,
  options?: unknown
): Snapshot<unknown> {
  const {
    configuration,
    tags,
    machine,
    children,
    context,
    can,
    hasTag,
    matches,
    toJSON,
    nextEvents,
    ...jsonValues
  } = state;

  const childrenJson: Record<string, unknown> = {};

  for (const id in children) {
    const child = children[id] as any;
    if (
      isDevelopment &&
      typeof child.src !== 'string' &&
      (!options || !('__unsafeAllowInlineActors' in (options as object)))
    ) {
      throw new Error('An inline child actor cannot be persisted.');
    }
    childrenJson[id as keyof typeof childrenJson] = {
      state: child.getPersistedState(options),
      src: child.src,
      systemId: child._systemId
    };
  }

  const persisted = {
    ...jsonValues,
    context: persistContext(context) as any,
    children: childrenJson
  };

  return persisted;
}

function persistContext(contextPart: Record<string, unknown>) {
  let copy: typeof contextPart | undefined;
  for (const key in contextPart) {
    const value = contextPart[key];
    if (value && typeof value === 'object') {
      if ('sessionId' in value && 'send' in value && 'ref' in value) {
        copy ??= Array.isArray(contextPart)
          ? (contextPart.slice() as typeof contextPart)
          : { ...contextPart };
        copy[key] = {
          xstate$$type: $$ACTOR_TYPE,
          id: (value as any as AnyActorRef).id
        };
      } else {
        const result = persistContext(value as typeof contextPart);
        if (result !== value) {
          copy ??= Array.isArray(contextPart)
            ? (contextPart.slice() as typeof contextPart)
            : { ...contextPart };
          copy[key] = result;
        }
      }
    }
  }
  return copy ?? contextPart;
}
