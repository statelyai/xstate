import isDevelopment from '#is-development';
import { $$ACTOR_TYPE } from './createActor.ts';
import { getStateValue } from './stateUtils.ts';
import type {
  AnyMachineSnapshot,
  AnyStateMachine,
  AnyActor,
  EventObject,
  HistoryValue,
  MachineContext,
  StateConfig,
  StateValue,
  StateValueMap,
  AnyActorRef,
  Snapshot,
  MetaObject,
  StateSchema,
  StateId,
  StateIdInputs,
  StateContextFromStateValue,
  SnapshotStatus,
  PersistedHistoryValue,
  AnyStateNode,
  LogicalTimer
} from './types.ts';
import { matchesState } from './utils.ts';
import {
  copySnapshotActorRef,
  getSnapshotActorRef,
  setSnapshotActorRef,
  type SnapshotActorRef,
  snapshotActorRef
} from './snapshotActorRef.ts';

export function isMachineSnapshot(value: unknown): value is AnyMachineSnapshot {
  return (
    !!value &&
    typeof value === 'object' &&
    'machine' in value &&
    'value' in value
  );
}

type Values<T> = T[keyof T];

type MatchingObjectStateValue<
  TStateValue extends Record<string, unknown>,
  TTestStateValue extends Record<string, unknown>
> =
  false extends Values<{
    [K in keyof TTestStateValue]: K extends keyof TStateValue
      ? NonNullable<TStateValue[K]> extends StateValue
        ? NonNullable<TTestStateValue[K]> extends StateValue
          ? [
              MatchingStateValue<
                NonNullable<TStateValue[K]>,
                NonNullable<TTestStateValue[K]>
              >
            ] extends [never]
            ? false
            : true
          : false
        : false
      : false;
  }>
    ? never
    : {
        [K in keyof TStateValue]: K extends keyof TTestStateValue
          ? MatchingStateValue<
              NonNullable<TStateValue[K]>,
              NonNullable<TTestStateValue[K]>
            >
          : TStateValue[K];
      };

type MatchingStateValue<
  TStateValue extends StateValue,
  TTestStateValue extends StateValue
> = StateValue extends TTestStateValue
  ? TStateValue
  : string extends TTestStateValue
    ? TStateValue
    : TStateValue extends unknown
      ? TTestStateValue extends string
        ? TStateValue extends string
          ? TTestStateValue extends TStateValue
            ? TTestStateValue
            : Extract<TStateValue, TTestStateValue>
          : TStateValue extends Record<string, unknown>
            ? TStateValue & Record<TTestStateValue, StateValue | undefined>
            : never
        : TTestStateValue extends Record<string, unknown>
          ? TStateValue extends Record<string, unknown>
            ? MatchingObjectStateValue<TStateValue, TTestStateValue>
            : never
          : never
      : never;

interface MachineSnapshotBase<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TChildren extends Record<string, AnyActorRef | undefined>,
  TStateValue extends StateValue,
  TTag extends string,
  _TOutput,
  TMeta extends MetaObject,
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
  /** Pending logical timers owned by this machine snapshot. */
  timers: Readonly<Record<string, LogicalTimer>>;
  /** @internal */
  _stateInputs: Record<string, Record<string, unknown>>;
  /** @internal */
  _nextTimerId: number;
  /** @internal */
  [snapshotActorRef]?: SnapshotActorRef;

  /**
   * Whether the current state value is a subset of the given partial state
   * value.
   *
   * @param partialStateValue
   */
  matches<const TTestStateValue extends string>(
    partialStateValue: TTestStateValue,
    ...args: string extends TTestStateValue ? [never] : []
  ): this is MachineSnapshot<
    StateContextFromStateValue<TStateSchema, TContext, TTestStateValue>,
    TEvent,
    TChildren,
    MatchingStateValue<TStateValue, TTestStateValue>,
    TTag,
    _TOutput,
    TMeta,
    TStateSchema
  >;
  matches<const TTestStateValue extends StateValueMap>(
    partialStateValue: TTestStateValue,
    ...args: string extends keyof TTestStateValue ? [never] : []
  ): this is MachineSnapshot<
    StateContextFromStateValue<TStateSchema, TContext, TTestStateValue>,
    TEvent,
    TChildren,
    MatchingStateValue<TStateValue, TTestStateValue>,
    TTag,
    _TOutput,
    TMeta,
    TStateSchema
  >;
  matches(partialStateValue: StateValue): boolean;

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

  // The dry-run logic lives on the machine so that non-machine bundles
  // (e.g. `createFSM`) don't pay for the transition-resolution machinery.
  return this.machine?._canTransition(this, event) ?? false;
};

const machineSnapshotToJSON = function toJSON(this: AnyMachineSnapshot) {
  const {
    _nodes: nodes,
    _stateInputs,
    [snapshotActorRef]: _actorRef,
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
  machine: AnyStateMachine,
  actorRef?: AnyActor
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
  const snapshot = {
    status: config.status as never,
    output: config.output,
    error: config.error,
    machine,
    context: config.context,
    _nodes: config._nodes,
    value: (config.value ??
      getStateValue(machine.root, config._nodes)) as never,
    tags: collectTags(config._nodes),
    children: config.children as any,
    timers: config.timers ?? {},
    historyValue: config.historyValue || {},
    _stateInputs: config._stateInputs || {},
    _nextTimerId: config._nextTimerId ?? 0,
    matches: machineSnapshotMatches as never,
    hasTag: machineSnapshotHasTag,
    can: machineSnapshotCan,
    getMeta: machineSnapshotGetMeta,
    getInputs: machineSnapshotGetInputs,
    toJSON: machineSnapshotToJSON
  };
  if (actorRef) {
    setSnapshotActorRef(snapshot, actorRef);
  }
  return snapshot;
}

export function cloneMachineSnapshot<TState extends AnyMachineSnapshot>(
  snapshot: TState,
  config: Partial<StateConfig<any, any>> = {}
): TState {
  const configWithSnapshot = {
    ...snapshot,
    ...config
  } as StateConfig<any, any>;

  if ((config._nodes ?? snapshot._nodes) === snapshot._nodes) {
    const clonedSnapshot = {
      status: configWithSnapshot.status as never,
      output: configWithSnapshot.output,
      error: configWithSnapshot.error,
      machine: snapshot.machine,
      context: configWithSnapshot.context,
      _nodes: snapshot._nodes,
      value: snapshot.value,
      tags: snapshot.tags,
      children: configWithSnapshot.children as any,
      timers: configWithSnapshot.timers ?? {},
      historyValue: configWithSnapshot.historyValue || {},
      _stateInputs: configWithSnapshot._stateInputs || {},
      _nextTimerId: configWithSnapshot._nextTimerId ?? 0,
      matches: machineSnapshotMatches as never,
      hasTag: machineSnapshotHasTag,
      can: machineSnapshotCan,
      getMeta: machineSnapshotGetMeta,
      getInputs: machineSnapshotGetInputs,
      toJSON: machineSnapshotToJSON
    } as unknown as TState;
    copySnapshotActorRef(snapshot, clonedSnapshot);
    return clonedSnapshot;
  }

  const clonedSnapshot = createMachineSnapshot(
    {
      ...configWithSnapshot,
      value: undefined
    },
    snapshot.machine
  ) as unknown as TState;
  copySnapshotActorRef(snapshot, clonedSnapshot);
  return clonedSnapshot;
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
    timers,
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
  const timersJson: Record<string, unknown> = {};

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
      registryKey: child.registryKey,
      syncSnapshot: child._syncSnapshot
    };
  }

  for (const id in timers) {
    const timer = timers[id];
    let target: string | { type: 'parent' };
    if (timer.target === 'self') {
      target = 'self';
    } else {
      const childId = Object.entries(children).find(
        ([, child]) => child === timer.target
      )?.[0];
      if (childId) {
        target = childId;
      } else if (
        timer.target === getSnapshotActorRef(snapshot)?.actor._parent
      ) {
        target = { type: 'parent' };
      } else {
        throw new Error(
          `Unable to persist timer '${id}': target actor '${timer.target.id}' is no longer addressable from this snapshot.`
        );
      }
    }
    timersJson[id] = {
      id: timer.id,
      delay: timer.delay,
      type: timer.type,
      event: timer.event,
      target
    };
  }

  const persisted: Record<string, unknown> = {
    ...jsonValues,
    context: persistContext(context) as any,
    children: childrenJson,
    timers: timersJson,
    historyValue: serializeHistoryValue(jsonValues.historyValue)
  };

  if (_stateInputs && Object.keys(_stateInputs).length > 0) {
    persisted.stateInputs = _stateInputs;
  }

  if (machine.version !== undefined) {
    persisted.version = machine.version;
  }

  return persisted as Snapshot<unknown>;
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
          id: (value as any as AnyActor).id
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
