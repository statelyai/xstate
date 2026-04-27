import isDevelopment from '#is-development';
import { $$ACTOR_TYPE } from './createActor.ts';
import { getStateValue, getTransitionResult, hasEffect } from './stateUtils.ts';
import type {
  AnyActorScope,
  AnyMachineSnapshot,
  AnyStateMachine,
  EventObject,
  HistoryValue,
  MachineContext,
  StateConfig,
  StateValue,
  AnyActorRef,
  Snapshot,
  IsNever,
  MetaObject,
  StateSchema,
  StateId,
  StateIdInputs,
  SnapshotStatus,
  PersistedHistoryValue,
  AnyStateNode
} from './types.ts';
import { matchesState } from './utils.ts';
import { createEmptyActor } from './actors/index.ts';

type ToTestStateValue<TStateValue extends StateValue> =
  TStateValue extends string
    ? TStateValue
    : IsNever<keyof TStateValue> extends true
      ? never
      :
          | keyof TStateValue
          | {
              [K in keyof TStateValue]?: ToTestStateValue<
                NonNullable<TStateValue[K]>
              >;
            };

export function isMachineSnapshot(value: unknown): value is AnyMachineSnapshot {
  return (
    !!value &&
    typeof value === 'object' &&
    'machine' in value &&
    'value' in value
  );
}

let emptyCanActor: AnyActorRef | undefined;
let emptyCanActorScope: AnyActorScope | undefined;

function getEmptyCanActor() {
  return (emptyCanActor ??= createEmptyActor());
}

function getEmptyCanActorScope(): AnyActorScope {
  if (emptyCanActorScope) {
    return emptyCanActorScope;
  }

  const actor = getEmptyCanActor();
  emptyCanActorScope = {
    self: actor,
    logger: () => {},
    id: '',
    sessionId: '',
    defer: () => {},
    system: actor.system,
    stopChild: () => {},
    emit: () => {},
    actionExecutor: () => {}
  };
  return emptyCanActorScope;
}

interface MachineSnapshotBase<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TChildren extends Record<string, AnyActorRef | undefined>,
  TStateValue extends StateValue,
  TTag extends string,
  TOutput,
  TMeta,
  TStateSchema extends StateSchema = StateSchema
> {
  /** The state machine that produced this state snapshot. */
  machine: AnyStateMachine;
  /** The tags of the active state nodes that represent the current state value. */
  tags: Set<string>;
  /**
   * The current state value.
   *
   * This represents the active state nodes in the state machine.
   *
   * - For atomic state nodes, it is a string.
   * - For compound parent state nodes, it is an object where:
   *
   *   - The key is the parent state node's key
   *   - The value is the current state value of the active child state node(s)
   *
   * @example
   *
   * ```ts
   * // single-level state node
   * snapshot.value; // => 'yellow'
   *
   * // nested state nodes
   * snapshot.value; // => { red: 'wait' }
   * ```
   */
  value: TStateValue;
  /** The current status of this snapshot. */
  status: SnapshotStatus;
  error: unknown;
  context: TContext;

  historyValue: Readonly<HistoryValue>;
  /** The enabled state nodes representative of the state value. */
  _nodes: Array<AnyStateNode>;
  /** An object mapping actor names to spawned/invoked actors. */
  children: TChildren;
  /** @internal */
  _stateInputs: Record<string, Record<string, unknown>>;

  /**
   * Whether the current state value is a subset of the given partial state
   * value.
   *
   * @param partialStateValue
   */
  matches: (partialStateValue: ToTestStateValue<TStateValue>) => boolean;

  /**
   * Whether the current state nodes has a state node with the specified `tag`.
   *
   * @param tag
   */
  hasTag: (tag: TTag) => boolean;

  /**
   * Determines whether sending the `event` will cause a non-forbidden
   * transition to be selected, even if the transitions have no actions nor
   * change the state value.
   *
   * @param event The event to test
   * @returns Whether the event will cause a transition
   */
  can: (event: TEvent) => boolean;

  getMeta: () => Record<
    StateId<TStateSchema> & string,
    TMeta | undefined // States might not have meta defined
  >;

  /**
   * Returns the inputs for the current active state nodes, keyed by state node
   * id.
   */
  getInputs: () => StateIdInputs<TStateSchema>;

  toJSON: () => unknown;
}

interface ActiveMachineSnapshot<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TChildren extends Record<string, AnyActorRef | undefined>,
  TStateValue extends StateValue,
  TTag extends string,
  TOutput,
  TMeta extends MetaObject,
  TStateSchema extends StateSchema
> extends MachineSnapshotBase<
    TContext,
    TEvent,
    TChildren,
    TStateValue,
    TTag,
    TOutput,
    TMeta,
    TStateSchema
  > {
  status: 'active';
  output: undefined;
  error: undefined;
}

interface DoneMachineSnapshot<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TChildren extends Record<string, AnyActorRef | undefined>,
  TStateValue extends StateValue,
  TTag extends string,
  TOutput,
  TMeta extends MetaObject,
  TStateSchema extends StateSchema
> extends MachineSnapshotBase<
    TContext,
    TEvent,
    TChildren,
    TStateValue,
    TTag,
    TOutput,
    TMeta,
    TStateSchema
  > {
  status: 'done';
  output: TOutput;
  error: undefined;
}

interface ErrorMachineSnapshot<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TChildren extends Record<string, AnyActorRef | undefined>,
  TStateValue extends StateValue,
  TTag extends string,
  TOutput,
  TMeta extends MetaObject,
  TStateSchema extends StateSchema
> extends MachineSnapshotBase<
    TContext,
    TEvent,
    TChildren,
    TStateValue,
    TTag,
    TOutput,
    TMeta,
    TStateSchema
  > {
  status: 'error';
  output: undefined;
  error: unknown;
}

interface StoppedMachineSnapshot<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TChildren extends Record<string, AnyActorRef | undefined>,
  TStateValue extends StateValue,
  TTag extends string,
  TOutput,
  TMeta extends MetaObject,
  TStateSchema extends StateSchema
> extends MachineSnapshotBase<
    TContext,
    TEvent,
    TChildren,
    TStateValue,
    TTag,
    TOutput,
    TMeta,
    TStateSchema
  > {
  status: 'stopped';
  output: undefined;
  error: undefined;
}

export type MachineSnapshot<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TChildren extends Record<string, AnyActorRef | undefined>,
  TStateValue extends StateValue,
  TTag extends string,
  TOutput,
  TMeta extends MetaObject,
  TStateSchema extends StateSchema
> =
  | ActiveMachineSnapshot<
      TContext,
      TEvent,
      TChildren,
      TStateValue,
      TTag,
      TOutput,
      TMeta,
      TStateSchema
    >
  | DoneMachineSnapshot<
      TContext,
      TEvent,
      TChildren,
      TStateValue,
      TTag,
      TOutput,
      TMeta,
      TStateSchema
    >
  | ErrorMachineSnapshot<
      TContext,
      TEvent,
      TChildren,
      TStateValue,
      TTag,
      TOutput,
      TMeta,
      TStateSchema
    >
  | StoppedMachineSnapshot<
      TContext,
      TEvent,
      TChildren,
      TStateValue,
      TTag,
      TOutput,
      TMeta,
      TStateSchema
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

  const transitionData = this.machine.getTransitionData(this, event, {} as any);

  return (
    !!transitionData?.length &&
    // Check that at least one transition is not forbidden
    transitionData.some((t) => {
      const res = getTransitionResult(t, this, event, getEmptyCanActorScope());
      return (
        t.target !== undefined ||
        res.targets?.length ||
        res.context ||
        hasEffect(t, this.context, event, this, getEmptyCanActor())
      );
    })
  );
};

const machineSnapshotToJSON = function toJSON(this: AnyMachineSnapshot) {
  const {
    _nodes: nodes,
    _stateInputs,
    tags,
    machine,
    getMeta,
    getInputs,
    toJSON,
    can,
    hasTag,
    matches,
    ...jsonValues
  } = this;
  return { ...jsonValues, tags: Array.from(tags) };
};

const machineSnapshotGetMeta = function getMeta(this: AnyMachineSnapshot) {
  const meta: Record<string, any> = {};
  for (const stateNode of this._nodes) {
    if (stateNode.meta !== undefined) {
      meta[stateNode.id] = stateNode.meta;
    }
  }
  return meta;
};

const machineSnapshotGetInputs = function getInputs(this: AnyMachineSnapshot) {
  return this._stateInputs as any;
};

function collectTags(stateNodes: Array<AnyStateNode>): Set<string> {
  const tags = new Set<string>();
  for (const stateNode of stateNodes) {
    for (const tag of stateNode.tags) {
      tags.add(tag);
    }
  }
  return tags;
}

export function createMachineSnapshot<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TChildren extends Record<string, AnyActorRef | undefined>,
  TStateValue extends StateValue,
  TTag extends string,
  TMeta extends MetaObject,
  TStateSchema extends StateSchema
>(
  config: StateConfig<TContext, TEvent>,
  machine: AnyStateMachine
): MachineSnapshot<
  TContext,
  TEvent,
  TChildren,
  TStateValue,
  TTag,
  undefined,
  TMeta,
  TStateSchema
> {
  return {
    status: config.status as never,
    output: config.output,
    error: config.error,
    machine,
    context: config.context,
    _nodes: config._nodes,
    value: getStateValue(machine.root, config._nodes) as never,
    tags: collectTags(config._nodes),
    children: config.children as any,
    historyValue: config.historyValue || {},
    _stateInputs: config._stateInputs || {},
    matches: machineSnapshotMatches as never,
    hasTag: machineSnapshotHasTag,
    can: machineSnapshotCan,
    getMeta: machineSnapshotGetMeta,
    getInputs: machineSnapshotGetInputs,
    toJSON: machineSnapshotToJSON
  };
}

export function cloneMachineSnapshot<TState extends AnyMachineSnapshot>(
  snapshot: TState,
  config: Partial<StateConfig<any, any>> = {}
): TState {
  return createMachineSnapshot(
    { ...snapshot, ...config } as StateConfig<any, any>,
    snapshot.machine
  ) as TState;
}

function serializeHistoryValue(
  historyValue: HistoryValue
): PersistedHistoryValue {
  const result: PersistedHistoryValue = {};

  for (const key in historyValue) {
    const value = historyValue[key];
    if (Array.isArray(value)) {
      result[key] = value.map((item) => ({ id: item.id }));
    }
  }

  return result;
}

export function getPersistedSnapshot<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TChildren extends Record<string, AnyActorRef | undefined>,
  TStateValue extends StateValue,
  TTag extends string,
  TOutput,
  TMeta extends MetaObject
>(
  snapshot: MachineSnapshot<
    TContext,
    TEvent,
    TChildren,
    TStateValue,
    TTag,
    TOutput,
    TMeta,
    any // state schema
  >,
  options?: unknown
): Snapshot<unknown> {
  const {
    _nodes: nodes,
    _stateInputs,
    tags,
    machine,
    children,
    context,
    can,
    hasTag,
    matches,
    getMeta,
    getInputs,
    toJSON,
    ...jsonValues
  } = snapshot;

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
      snapshot: child.getPersistedSnapshot(options),
      src: child.src,
      systemId: child.systemId,
      syncSnapshot: child._syncSnapshot
    };
  }

  const persisted = {
    ...jsonValues,
    context: persistContext(context) as any,
    children: childrenJson,
    historyValue: serializeHistoryValue(jsonValues.historyValue)
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
