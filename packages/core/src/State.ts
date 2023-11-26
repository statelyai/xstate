import isDevelopment from '#is-development';
import { $$ACTOR_TYPE } from './interpreter.ts';
import type { StateNode } from './StateNode.ts';
import type { StateMachine } from './StateMachine.ts';
import { getStateValue } from './stateUtils.ts';
import { TypegenDisabled, TypegenEnabled } from './typegenTypes.ts';
import type {
  ProvidedActor,
  AnyMachineSnapshot,
  AnyStateMachine,
  EventObject,
  HistoryValue,
  MachineContext,
  Prop,
  StateConfig,
  StateValue,
  AnyActorRef,
  EventDescriptor,
  Snapshot,
  ParameterizedObject
} from './types.ts';
import { flatten, matchesState } from './utils.ts';

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
  TChildren extends Record<string, AnyActorRef | undefined>,
  TTag extends string,
  TOutput,
  TResolvedTypesMeta = TypegenDisabled
> {
  machine: StateMachine<
    TContext,
    TEvent,
    TChildren,
    ProvidedActor,
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
  _nodes: Array<StateNode<TContext, TEvent>>;
  /**
   * An object mapping actor names to spawned/invoked actors.
   */
  children: TChildren;

  /**
   * Whether the current state value is a subset of the given parent state value.
   * @param testValue
   */
  matches: <
    TSV extends TResolvedTypesMeta extends TypegenEnabled
      ? Prop<Prop<TResolvedTypesMeta, 'resolved'>, 'matchesStates'>
      : StateValue
  >(
    this: MachineSnapshot<
      TContext,
      TEvent,
      TChildren,
      TTag,
      TOutput,
      TResolvedTypesMeta
    >,
    testValue: TSV
  ) => boolean;

  /**
   * Whether the current state nodes has a state node with the specified `tag`.
   * @param tag
   */
  hasTag: (
    this: MachineSnapshot<
      TContext,
      TEvent,
      TChildren,
      TTag,
      TOutput,
      TResolvedTypesMeta
    >,
    tag: TTag
  ) => boolean;

  /**
   * Determines whether sending the `event` will cause a non-forbidden transition
   * to be selected, even if the transitions have no actions nor
   * change the state value.
   *
   * @param event The event to test
   * @returns Whether the event will cause a transition
   */
  can: (
    this: MachineSnapshot<
      TContext,
      TEvent,
      TChildren,
      TTag,
      TOutput,
      TResolvedTypesMeta
    >,
    event: TEvent
  ) => boolean;

  getMeta: (
    this: MachineSnapshot<
      TContext,
      TEvent,
      TChildren,
      TTag,
      TOutput,
      TResolvedTypesMeta
    >
  ) => Record<string, any>;

  toJSON: (
    this: MachineSnapshot<
      TContext,
      TEvent,
      TChildren,
      TTag,
      TOutput,
      TResolvedTypesMeta
    >
  ) => unknown;
}

interface ActiveMachineSnapshot<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TChildren extends Record<string, AnyActorRef | undefined>,
  TTag extends string,
  TOutput,
  TResolvedTypesMeta = TypegenDisabled
> extends MachineSnapshotBase<
    TContext,
    TEvent,
    TChildren,
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
  TChildren extends Record<string, AnyActorRef | undefined>,
  TTag extends string,
  TOutput,
  TResolvedTypesMeta = TypegenDisabled
> extends MachineSnapshotBase<
    TContext,
    TEvent,
    TChildren,
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
  TChildren extends Record<string, AnyActorRef | undefined>,
  TTag extends string,
  TOutput,
  TResolvedTypesMeta = TypegenDisabled
> extends MachineSnapshotBase<
    TContext,
    TEvent,
    TChildren,
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
  TChildren extends Record<string, AnyActorRef | undefined>,
  TTag extends string,
  TOutput,
  TResolvedTypesMeta = TypegenDisabled
> extends MachineSnapshotBase<
    TContext,
    TEvent,
    TChildren,
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
  TChildren extends Record<string, AnyActorRef | undefined>,
  TTag extends string,
  TOutput,
  TResolvedTypesMeta = TypegenDisabled
> =
  | ActiveMachineSnapshot<
      TContext,
      TEvent,
      TChildren,
      TTag,
      TOutput,
      TResolvedTypesMeta
    >
  | DoneMachineSnapshot<
      TContext,
      TEvent,
      TChildren,
      TTag,
      TOutput,
      TResolvedTypesMeta
    >
  | ErrorMachineSnapshot<
      TContext,
      TEvent,
      TChildren,
      TTag,
      TOutput,
      TResolvedTypesMeta
    >
  | StoppedMachineSnapshot<
      TContext,
      TEvent,
      TChildren,
      TTag,
      TOutput,
      TResolvedTypesMeta
    >;

const machineSnapshotMatches = function matches(
  this: AnyMachineSnapshot,
  testValue: StateValue
) {
  return matchesState(testValue, this.value);
};

const machineSnapshotHasTag = function hasTag(
  this: AnyMachineSnapshot,
  tag: string
) {
  return this.tags.has(tag);
};

const machineSnapshotCan = function can(
  this: AnyMachineSnapshot,
  event: EventObject
) {
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
};

const machineSnapshotToJSON = function toJSON(this: AnyMachineSnapshot) {
  const {
    _nodes: nodes,
    tags,
    machine,
    getMeta,
    toJSON,
    can,
    hasTag,
    matches,
    ...jsonValues
  } = this;
  return { ...jsonValues, tags: Array.from(tags) };
};

const machineSnapshotGetMeta = function getMeta(this: AnyMachineSnapshot) {
  return this._nodes.reduce(
    (acc, stateNode) => {
      if (stateNode.meta !== undefined) {
        acc[stateNode.id] = stateNode.meta;
      }
      return acc;
    },
    {} as Record<string, any>
  );
};

export function createMachineSnapshot<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TChildren extends Record<string, AnyActorRef | undefined>,
  TTag extends string,
  TResolvedTypesMeta = TypegenDisabled
>(
  config: StateConfig<TContext, TEvent>,
  machine: AnyStateMachine
): MachineSnapshot<
  TContext,
  TEvent,
  TChildren,
  TTag,
  undefined,
  TResolvedTypesMeta
> {
  return {
    status: config.status as never,
    output: config.output,
    error: config.error,
    machine,
    context: config.context,
    _nodes: config._nodes,
    value: getStateValue(machine.root, config._nodes),
    tags: new Set(flatten(config._nodes.map((sn) => sn.tags))),
    children: config.children as any,
    historyValue: config.historyValue || {},
    // this one is generic in the target and it's hard to create a matching non-generic source signature
    matches: machineSnapshotMatches as any,
    hasTag: machineSnapshotHasTag,
    can: machineSnapshotCan,
    getMeta: machineSnapshotGetMeta,
    toJSON: machineSnapshotToJSON
  };
}

export function cloneMachineSnapshot<TState extends AnyMachineSnapshot>(
  state: TState,
  config: Partial<StateConfig<any, any>> = {}
): TState {
  return createMachineSnapshot(
    { ...state, ...config } as StateConfig<any, any>,
    state.machine
  ) as TState;
}

export function getPersistedState<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TChildren extends Record<string, AnyActorRef | undefined>,
  TTag extends string,
  TOutput,
  TResolvedTypesMeta = TypegenDisabled
>(
  state: MachineSnapshot<
    TContext,
    TEvent,
    TChildren,
    TTag,
    TOutput,
    TResolvedTypesMeta
  >,
  options?: unknown
): Snapshot<unknown> {
  const {
    _nodes: nodes,
    tags,
    machine,
    children,
    context,
    can,
    hasTag,
    matches,
    getMeta,
    toJSON,
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
      systemId: child._systemId,
      syncSnapshot: child._syncSnapshot
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
