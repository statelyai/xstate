import { getTimerStart } from './timerClock.ts';
import { getScheduledTimerKey, getTimerKey } from './timerKey.ts';
import isDevelopment from '#is-development';
import { getStateValue, isStateId } from './stateUtils.ts';
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
  StateIdReference,
  SnapshotStatus,
  PersistedHistoryValue,
  AnyStateNode,
  LogicalTimer,
  SerializedActorRef
} from './types.ts';
import { describeMachine, isActorRefLike, matchesState } from './utils.ts';
import {
  copySnapshotActorRef,
  getSnapshotActorRef,
  setSnapshotActorRef
} from './snapshotActorRef.ts';
import { isRemoteActorRef, isSerializedActorRef } from './remoteActorRef.ts';
import { findNonJsonPath } from './persistedSnapshotFormat.ts';

const emptySnapshotRecord = Object.freeze({});
const emptyTimers: readonly LogicalTimer[] = Object.freeze([]);

function compactTimers(
  timers: readonly LogicalTimer[] | undefined
): readonly LogicalTimer[] {
  return timers?.length ? timers : emptyTimers;
}

/**
 * Deep-freezes the plain objects and arrays in machine context so accidental
 * in-place mutation throws instead of silently corrupting state. Actor refs,
 * class instances, Map/Set, Date, etc. are left untouched. Callers guard with
 * `isDevelopment` so production builds pay nothing.
 *
 * @internal
 */
const deepFrozenContext = new WeakSet<object>();

export function freezeContext(value: any, visiting = new Set<object>()): void {
  if (
    !value ||
    typeof value !== 'object' ||
    deepFrozenContext.has(value) ||
    visiting.has(value)
  ) {
    return;
  }
  if (!Array.isArray(value)) {
    const proto = Object.getPrototypeOf(value);
    if (
      (proto !== Object.prototype && proto !== null) ||
      isActorRefLike(value)
    ) {
      return;
    }
  }
  visiting.add(value);
  try {
    Object.freeze(value);
  } catch {
    // Some proxies (e.g. framework reactive state) refuse to be frozen.
    return;
  }
  // Descend even if the object was already frozen elsewhere: its children
  // may still be mutable.
  for (const key of Object.keys(value)) {
    freezeContext(value[key], visiting);
  }
  deepFrozenContext.add(value);
}

function compactSnapshotRecord<T extends object>(value: T | undefined): T {
  if (value === emptySnapshotRecord) {
    return value;
  }
  return value && Object.keys(value).length
    ? value
    : (emptySnapshotRecord as T);
}

/** @public */
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

type StateValuePath<TStateValue extends StateValue> =
  TStateValue extends StateValueMap
    ? {
        [K in keyof TStateValue & string]:
          | K
          | (NonNullable<TStateValue[K]> extends infer TChild extends StateValue
              ? `${K}.${StateValuePath<TChild>}`
              : never);
      }[keyof TStateValue & string]
    : TStateValue;

/**
 * The values that `snapshot.matches(...)` accepts for a state value: a state
 * key, a dot-delimited path to a descendant state, or a partial state value.
 * Non-literal state values accept any value.
 */
export type ToTestStateValue<TStateValue extends StateValue> =
  StateValue extends TStateValue
    ? StateValue
    : TStateValue extends string
      ? TStateValue
      : TStateValue extends StateValueMap
        ? string extends keyof TStateValue
          ? StateValue
          :
              | StateValuePath<TStateValue>
              | {
                  [K in keyof TStateValue]?: NonNullable<
                    TStateValue[K]
                  > extends infer TChild extends StateValue
                    ? ToTestStateValue<TChild>
                    : never;
                }
        : never;

/**
 * `true` if `TTestStateValue` can match `TStateValue`, checked per position:
 * each literal key names a state at its level and each literal child matches
 * that state. A non-literal value (`string`, or a map with `string` keys)
 * passes at its own position only, so `{ checkout: string }` is accepted and
 * `{ nope: 'payment', checkout: string }` is not.
 */
type IsTestStateValueValid<
  TStateValue extends StateValue,
  TTestStateValue
> = StateValue extends TStateValue
  ? true
  : string extends TTestStateValue
    ? true
    : TTestStateValue extends string
      ? [TTestStateValue] extends [StateValuePath<TStateValue>]
        ? true
        : false
      : TTestStateValue extends StateValueMap
        ? string extends keyof TTestStateValue
          ? true
          : true extends (
                TStateValue extends StateValueMap
                  ? IsTestStateValueMapValid<TStateValue, TTestStateValue>
                  : never
              )
            ? true
            : false
        : false;

type IsTestStateValueMapValid<
  TStateValueMap extends StateValueMap,
  TTestStateValue extends StateValueMap
> = [Exclude<keyof TTestStateValue, keyof TStateValueMap>] extends [never]
  ? false extends {
      [K in keyof TTestStateValue]-?: IsTestStateValueValid<
        NonNullable<TStateValueMap[K & keyof TStateValueMap]>,
        NonNullable<TTestStateValue[K]>
      >;
    }[keyof TTestStateValue]
    ? false
    : true
  : false;

/**
 * `unknown` if `matches(...)` accepts `TTestStateValue` for `TStateValue`,
 * otherwise `never`. Literal values must name states; a non-literal value
 * (such as a `string` leaf) is accepted at its own position.
 */
export type TestStateValueCheck<
  TStateValue extends StateValue,
  TTestStateValue extends StateValue
> = [TTestStateValue] extends [ToTestStateValue<TStateValue>]
  ? unknown
  : false extends IsTestStateValueValid<TStateValue, TTestStateValue>
    ? never
    : unknown;

/**
 * The `#id` references a snapshot (or union of snapshots) accepts, read from
 * its `getMeta()` keys so the overload does not depend on the state schema.
 */
type SnapshotStateIdReference<TSnapshot> = TSnapshot extends {
  getMeta: () => Record<infer TStateId, any>;
}
  ? string extends TStateId
    ? `#${string}`
    : `#${Exclude<TStateId, ''> & string}`
  : `#${string}`;

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
  nodes: Array<AnyStateNode>;
  /** An object mapping actor names to spawned/invoked actors. */
  children: TChildren;
  /** Pending logical timers owned by this machine snapshot. */
  timers: readonly LogicalTimer[];
  /** @internal */
  _stateInputs: Record<string, Record<string, unknown>>;
  /** @internal */
  _nextTimerId: number;
  /** @internal */
  _nextActorIds?: Record<string, number>;
  /**
   * Whether the current state value is a subset of the given partial state
   * value, or, for a `'#id'` reference, whether the state node with that `id`
   * is active.
   *
   * @param partialStateValue
   */
  matches<const TTestStateId extends StateIdReference<TStateSchema>>(
    stateId: TTestStateId
  ): boolean;
  matches<
    const TTestStateValue extends Extract<ToTestStateValue<TStateValue>, string>
  >(
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
  matches<
    const TTestStateValue extends Extract<
      ToTestStateValue<TStateValue>,
      StateValueMap
    >
  >(
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
  // Unions of snapshots (whose overloads above differ)
  matches<TSnapshot extends { value: StateValue }>(
    this: TSnapshot,
    stateId: NoInfer<SnapshotStateIdReference<TSnapshot>>
  ): boolean;
  // Non-literal values, and unions of snapshots
  matches<
    TSnapshot extends { value: StateValue },
    const TTestStateValue extends StateValue
  >(
    this: TSnapshot,
    partialStateValue: TTestStateValue &
      NoInfer<TestStateValueCheck<TSnapshot['value'], TTestStateValue>>
  ): boolean;

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
   * Returns false for terminal snapshots. Throws if transition evaluation
   * throws; this dry run does not run onError recovery.
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

/** @public */
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
  if (typeof testValue === 'string' && isStateId(testValue)) {
    const stateNode = this.machine.getStateNodeById(testValue);
    return this.nodes.includes(stateNode);
  }
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
    nodes,
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
  for (const stateNode of this.nodes) {
    if (stateNode.meta !== undefined) {
      meta[stateNode.id] = stateNode.meta;
    }
  }
  return meta;
};

const machineSnapshotGetInputs = function getInputs<
  TStateSchema extends StateSchema
>(
  this: AnyMachineSnapshot & {
    _stateInputs: StateIdInputs<TStateSchema>;
  }
): StateIdInputs<TStateSchema> {
  return this._stateInputs;
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
    nodes: config._nodes,
    value: (config.value ??
      getStateValue(machine.root, config._nodes)) as never,
    tags: collectTags(config._nodes),
    children: compactSnapshotRecord(config.children) as TChildren,
    timers: compactTimers(config.timers),
    historyValue: compactSnapshotRecord(config.historyValue),
    _stateInputs: compactSnapshotRecord(config._stateInputs),
    _nextTimerId: config._nextTimerId ?? 0,
    _nextActorIds: config._nextActorIds,
    matches: machineSnapshotMatches as never,
    hasTag: machineSnapshotHasTag,
    can: machineSnapshotCan,
    getMeta: machineSnapshotGetMeta,
    getInputs: machineSnapshotGetInputs,
    toJSON: machineSnapshotToJSON
  };
  if (isDevelopment) {
    freezeContext(snapshot.context);
  }
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

  if ((config._nodes ?? snapshot.nodes) === snapshot.nodes) {
    const clonedSnapshot = {
      status: configWithSnapshot.status as never,
      output: configWithSnapshot.output,
      error: configWithSnapshot.error,
      machine: snapshot.machine,
      context: configWithSnapshot.context,
      nodes: snapshot.nodes,
      value: snapshot.value,
      tags: snapshot.tags,
      children: compactSnapshotRecord(configWithSnapshot.children),
      timers: compactTimers(configWithSnapshot.timers),
      historyValue: compactSnapshotRecord(configWithSnapshot.historyValue),
      _stateInputs: compactSnapshotRecord(configWithSnapshot._stateInputs),
      _nextTimerId: configWithSnapshot._nextTimerId ?? 0,
      _nextActorIds: configWithSnapshot._nextActorIds,
      matches: machineSnapshotMatches as never,
      hasTag: machineSnapshotHasTag,
      can: machineSnapshotCan,
      getMeta: machineSnapshotGetMeta,
      getInputs: machineSnapshotGetInputs,
      toJSON: machineSnapshotToJSON
    } as unknown as TState;
    if (isDevelopment) {
      freezeContext(clonedSnapshot.context);
    }
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
    nodes,
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

  if (isDevelopment) {
    // Before persistContext, which rejects cycles with an error.
    warnOnNonJsonPayload(
      {
        context,
        output: jsonValues.output,
        error: jsonValues.error,
        stateInputs: _stateInputs
      },
      machine.id
    );
  }

  const childrenJson: Record<string, unknown> = {};
  const timersJson: unknown[] = [];

  const embedChildren =
    (options as { embedChildren?: boolean } | undefined)?.embedChildren !==
    false;
  for (const id in children) {
    const child = children[id] as any;
    const sourceKey = typeof child.src === 'string' ? child.src : undefined;
    // An inline invoke has no source key; it restores through the invoke
    // definition with its id among the active states.
    const invoked =
      sourceKey === undefined &&
      child._invoked === true &&
      nodes.some((node) => node.invoke.some((def) => def.id === id));
    if (
      sourceKey === undefined &&
      !invoked &&
      (!options || !('__unsafeAllowInlineActors' in (options as object)))
    ) {
      throw new Error('An inline child actor cannot be persisted.');
    }
    // Children are referenced by their logical address. Embedding the child
    // state is the co-locating runtime's whole-tree checkpoint capability;
    // remote handles never embed — their state lives with another runtime.
    const embed = embedChildren && !isRemoteActorRef(child);
    if (!embed && sourceKey === undefined) {
      // Fail where it is actionable: a by-address reference without a
      // registered source key could be persisted but never restored.
      throw new Error(
        `Unable to persist child '${id}' by address: it requires a registered source key.`
      );
    }
    childrenJson[id as keyof typeof childrenJson] = {
      address: child.address,
      // The explicit marker disambiguates a by-address reference from a child
      // whose own persisted snapshot happens to be undefined.
      ...(embed
        ? { snapshot: child.getPersistedSnapshot(options) }
        : {
            remote: true,
            // A remote handle's sessionId IS the host-supplied incarnation
            // token, round-tripped verbatim. A local child persisted by
            // address never stamps its own sessionId: that value is this
            // incarnation's, not a durable identity, and it would make
            // persisted snapshots nondeterministic across replays.
            incarnation: isRemoteActorRef(child) ? child.sessionId : undefined
          }),
      ...(invoked ? {} : { src: child.src }),
      registryKey: child.registryKey,
      syncSnapshot: child._syncSnapshot
    };
  }

  const snapshotActor = getSnapshotActorRef(snapshot)?.actor;
  // Only the wall clock is stamped into persisted timers: a custom clock's
  // readings (a simulated clock, a monotonic counter) are meaningless in any
  // other process, and restoring them under the wall clock would fire every
  // pending delay instantly. Pure-transition snapshots have no local
  // schedule; durable executions record an accepted start separately.
  const scheduledTimers = snapshotActor?.system?._clock?.now
    ? undefined
    : snapshotActor?.system?._snapshot?._scheduledTimers;
  for (const timer of timers) {
    let event = timer.event;
    if (event.type === 'xstate.timeout.actor') {
      event = { ...event };
      delete (event as EventObject & { sessionId?: string }).sessionId;
    }
    let target: string | { type: 'parent' } | SerializedActorRef;
    if (timer.target === 'self') {
      target = 'self';
    } else if (isSerializedActorRef(timer.target)) {
      // An address-backed target resolves when the timer fires.
      target = { ...timer.target };
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
          `Unable to persist timer ${timer.id !== undefined ? `'${timer.id}'` : `for event '${timer.event.type}'`}: target actor '${timer.target.id}' is no longer addressable from this snapshot.`
        );
      }
    }
    // A live runtime knows when the timer is due; persist the wall-clock
    // start (dueAt - declared delay) so restore can honor the absolute
    // deadline. Derived from dueAt, not the scheduling moment, so repeated
    // persist/restore cycles keep the same deadline. Without a live schedule
    // (a restored-but-never-started actor, a pure-transition snapshot) the
    // timer's accepted durable start or carried-in start passes through,
    // so re-persisting cannot push the deadline back.
    const scheduled =
      scheduledTimers?.[
        getScheduledTimerKey(snapshotActor!, getTimerKey(timer))
      ];
    const scheduledAt = scheduled
      ? scheduled.dueAt - timer.delay
      : getTimerStart(timer);
    timersJson.push({
      ...(timer.id !== undefined && { id: timer.id }),
      ...(timer.seq !== undefined && { seq: timer.seq }),
      delay: timer.delay,
      type: timer.type,
      event,
      target,
      ...(scheduledAt !== undefined && { scheduledAt })
    });
  }

  const persisted: Record<string, unknown> = {
    ...jsonValues,
    context: persistContext(
      context,
      () => getSnapshotActorRef(snapshot)?.actor.id ?? machine.id
    ) as any,
    children: childrenJson,
    timers: timersJson,
    historyValue: serializeHistoryValue(jsonValues.historyValue)
  };

  if (_stateInputs && Object.keys(_stateInputs).length > 0) {
    persisted.stateInputs = _stateInputs;
  }

  if (machine.version !== undefined) {
    persisted.machine = {
      id: machine.id,
      version: machine.version
    };
  }

  return persisted as Snapshot<unknown>;
}

function warnOnNonJsonPayload(
  persisted: Record<string, unknown>,
  machineId: string
) {
  for (const key of ['context', 'output', 'error', 'stateInputs']) {
    const found = findNonJsonPath(persisted[key], key);
    if (found) {
      console.warn(
        `Persisted snapshot of ${describeMachine(machineId)} contains a non-JSON value (${found.kind}) at '${found.path}'. Persisted snapshots must be JSON-serializable; this value will be lost or throw in JSON.stringify.`
      );
      return;
    }
  }
}

function persistContext(
  contextPart: Record<string, unknown>,
  getActorId: () => string,
  path = 'context',
  ancestors: object[] = []
) {
  // `ancestors` is the current descent path: a shared, non-circular object
  // reached twice is fine; one that contains itself is not JSON.
  ancestors.push(contextPart);
  let copy: typeof contextPart | undefined;
  for (const key in contextPart) {
    const value = contextPart[key];
    if (value && typeof value === 'object') {
      if (isActorRefLike(value)) {
        copy ??= Array.isArray(contextPart)
          ? (contextPart.slice() as typeof contextPart)
          : { ...contextPart };
        // The address lets refs to non-children still route after restore.
        copy[key] = { $actor: (value as any as AnyActor).address };
      } else {
        const valuePath = Array.isArray(contextPart)
          ? `${path}[${key}]`
          : `${path}.${key}`;
        if (ancestors.includes(value)) {
          throw new Error(
            `Cannot persist actor "${getActorId()}": circular reference at ${valuePath}`
          );
        }
        const result = persistContext(
          value as typeof contextPart,
          getActorId,
          valuePath,
          ancestors
        );
        if (result !== value) {
          copy ??= Array.isArray(contextPart)
            ? (contextPart.slice() as typeof contextPart)
            : { ...contextPart };
          copy[key] = result;
        }
      }
    }
  }
  ancestors.pop();
  return copy ?? contextPart;
}
