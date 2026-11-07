import isDevelopment from '#is-development';
import { Actor } from '../createActor.ts';
import { diagnoseActorOptions } from '../devDiagnostics.ts';
import { createInvokeTimeoutEvent } from '../eventUtils.ts';
import {
  attachSnapshotActorRef,
  createInertActorScope,
  isInertActorScope,
  setInertActorScopeSnapshot
} from '../inertActorScope.ts';
import { setSnapshotActorRef } from '../snapshotActorRef.ts';
import { describeMachine } from '../utils.ts';
import { xstateError } from '../xstateError.ts';
import {
  InvalidSnapshotError,
  validatePersistedSnapshot
} from '../persistedSnapshotValidation.ts';
import {
  createRemoteActorRef,
  isSerializedActorRef
} from '../remoteActorRef.ts';
import { cloneMachineSnapshot, createMachineSnapshot } from '../State.ts';
import { StateMachine } from '../StateMachine.ts';
import { StateNode } from '../StateNode.ts';
import { parseGeneratedActorId } from '../system.ts';
import type {
  ActorOptions,
  ActorRestoreHook,
  AnyActor,
  AnyActorLogic,
  AnyActorScope,
  AnyEventObject,
  AnyMachineSnapshot,
  AnyStateMachine,
  AnyStateNode,
  EventObject,
  HistoryValue,
  LogicalTimer,
  RestorablePersistedSnapshotFor,
  Snapshot,
  SnapshotFrom
} from '../types.ts';

export { snapshotSchema } from '../machineSchemas.ts';
export type { MachinePersistedSnapshotSchema } from '../machineSchemas.ts';

/**
 * Options for {@link restoreActor}: the {@link ActorOptions} of `createActor`
 * except `input` (a restored actor resumes, it does not initialize).
 *
 * @public
 */
export type RestoreActorOptions<TLogic extends AnyActorLogic> = Omit<
  ActorOptions<TLogic>,
  'input'
> & {
  /** Restores the actor into this system (from `createSystem()`). */
  system?: { createActor: (logic: any, options?: any) => AnyActor };
};

/**
 * Creates an actor that resumes from a persisted snapshot instead of starting
 * fresh. Works for any actor logic. Machine snapshots are validated, migrated
 * (`migrate` in the machine config) and their invoked/spawned children are
 * restored recursively.
 *
 * A snapshot that cannot be restored produces an actor whose snapshot has
 * `status: 'error'`.
 *
 * @example
 *
 * ```ts
 * import { restoreActor } from 'xstate/persist';
 *
 * const actor = restoreActor(machine, persistedSnapshot).start();
 * ```
 *
 * @public
 */
export function restoreActor<TLogic extends AnyActorLogic>(
  logic: TLogic,
  persistedSnapshot: Snapshot<unknown> &
    Partial<RestorablePersistedSnapshotFor<NoInfer<TLogic>>>,
  options?: RestoreActorOptions<TLogic>
): Actor<TLogic> {
  const { system, ...actorOptions } = options ?? {};
  diagnoseActorOptions(actorOptions);
  const resolvedOptions = {
    ...actorOptions,
    _restore: createRestoreHook(logic, persistedSnapshot)
  } as ActorOptions<TLogic>;
  return system
    ? (system.createActor(logic, resolvedOptions) as Actor<TLogic>)
    : new Actor(logic, resolvedOptions);
}

/**
 * @internal Restores `persisted` for any actor logic: machines through
 * {@link restoreMachineSnapshot}, other logic through its own
 * `restoreSnapshot` (or verbatim).
 */
export function restoreLogicSnapshot<TLogic extends AnyActorLogic>(
  logic: TLogic,
  persisted: unknown,
  actorScope?: AnyActorScope
): SnapshotFrom<TLogic> {
  if (logic instanceof StateMachine) {
    return restoreMachineSnapshot(
      // `logic` may be a reactive Proxy (e.g. a Vue `ref(machine)`); the state
      // nodes must come from the raw machine, like those of its bound methods
      logic._raw(),
      persisted as Snapshot<unknown>,
      actorScope
    ) as SnapshotFrom<TLogic>;
  }
  // Only `undefined` means "no snapshot": an explicit `null` (or another
  // non-object) is a malformed snapshot the logic reports.
  if (!logic.restoreSnapshot && persisted === null) {
    throw new Error(
      isDevelopment ? 'Persisted snapshot must be an object.' : xstateError(46)
    );
  }
  return logic.restoreSnapshot
    ? logic.restoreSnapshot(persisted as Snapshot<unknown>, actorScope)
    : (persisted as SnapshotFrom<TLogic>);
}

function createRestoreHook(
  logic: AnyActorLogic,
  persisted: unknown
): ActorRestoreHook {
  return {
    restore: (actorScope) => restoreLogicSnapshot(logic, persisted, actorScope),
    error: (error) =>
      logic instanceof StateMachine
        ? createRestoreErrorSnapshot(logic, persisted, error)
        : undefined
  };
}

/**
 * Builds a machine-shaped `'error'` snapshot (root configuration, no children)
 * for a persisted snapshot that failed to restore, so consumers keep
 * `matches()`, `can()` and friends.
 */
function createRestoreErrorSnapshot(
  machine: AnyStateMachine,
  persisted: unknown,
  error: unknown
): AnyMachineSnapshot {
  const context = (persisted as { context?: unknown } | undefined)?.context;
  return cloneMachineSnapshot(
    createMachineSnapshot(
      {
        context: context && typeof context === 'object' ? context : {},
        _nodes: [machine.root],
        children: {},
        status: 'active'
      },
      machine
    ),
    { status: 'error', error }
  ) as any;
}

/**
 * @internal Restores a persisted machine snapshot: validates it, runs
 * `migrate` on version mismatch, recursively restores children (remote
 * children become address handles) and revives timers, history and actor refs
 * in context.
 */
export function restoreMachineSnapshot<TMachine extends AnyStateMachine>(
  machine: TMachine,
  snapshot: Snapshot<unknown>,
  actorScope?: AnyActorScope
): SnapshotFrom<TMachine> {
  const usesInertScope = !actorScope;
  const resolvedActorScope = (actorScope ??
    createInertActorScope(machine)) as AnyActorScope;
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new InvalidSnapshotError(
      isDevelopment
        ? `Persisted snapshot for ${describeMachine(machine.id)} must be an object.`
        : xstateError(24, machine.id)
    );
  }
  const snapshotMachine = (snapshot as any).machine;
  // A live machine snapshot carries its producing machine so helpers such as
  // `matches()` can resolve state nodes. That runtime association is not the
  // persisted `{ id, version }` identity written by getPersistedSnapshot().
  const persistedMachine =
    snapshotMachine &&
    typeof snapshotMachine === 'object' &&
    typeof snapshotMachine.transition === 'function' &&
    'root' in snapshotMachine
      ? undefined
      : snapshotMachine;
  const legacyPersistedVersion: string | undefined = (snapshot as any).version;
  const persistedVersion: string | undefined =
    typeof persistedMachine?.version === 'string'
      ? persistedMachine.version
      : legacyPersistedVersion;
  if (
    legacyPersistedVersion !== undefined &&
    persistedMachine?.version !== undefined &&
    persistedMachine.version !== legacyPersistedVersion
  ) {
    throw new Error(
      isDevelopment
        ? `Persisted snapshot version '${legacyPersistedVersion}' conflicts with machine version '${persistedMachine.version}'.`
        : xstateError(34, legacyPersistedVersion, persistedMachine.version)
    );
  }
  if (
    persistedMachine &&
    typeof persistedMachine.id === 'string' &&
    persistedMachine.id !== machine.id
  ) {
    throw new Error(
      isDevelopment
        ? `Machine ID mismatch: persisted snapshot was created by machine '${persistedMachine.id}', but machine '${machine.id}' was provided.`
        : xstateError(35, persistedMachine.id, machine.id)
    );
  }
  if (persistedVersion !== machine.version) {
    const migrate = (machine.config as any).migrate;
    if (typeof migrate !== 'function') {
      throw new Error(
        isDevelopment
          ? `Persisted snapshot version '${persistedVersion}' does not match machine version '${machine.version}' for machine '${machine.id}'. Provide a \`migrate(persistedSnapshot, fromVersion)\` function in the machine config to migrate old snapshots.`
          : xstateError(36, persistedVersion, machine.version)
      );
    }
    snapshot = migrate(snapshot, persistedVersion);
  }

  const snapshotData = snapshot as any;
  const { nodes, childLogics } = validatePersistedSnapshot(
    machine,
    snapshotData
  );
  const children: Record<string, AnyActor> = {};
  const snapshotChildren: Record<
    string,
    {
      src?: string | AnyActorLogic;
      snapshot?: Snapshot<unknown>;
      address?: string;
      remote?: boolean;
      incarnation?: string;
      syncSnapshot?: boolean;
      registryKey?: string;
    }
  > = snapshotData.children;

  for (const actorId of Object.keys(snapshotChildren)) {
    const actorData = snapshotChildren[actorId];

    if (actorData.remote === true && actorData.address !== undefined) {
      if (typeof actorData.src !== 'string') {
        // Fail loudly instead of fabricating a source key that hosts would
        // route by.
        throw new Error(
          isDevelopment
            ? `Unable to restore remote child '${actorId}': a child referenced by address requires a registered source key.`
            : xstateError(28, actorId)
        );
      }
      // The child's state lives with another runtime; restore a
      // location-transparent handle constructed from its identity alone.
      // The handle keeps its persisted address verbatim: the owning
      // runtime's identity for the child wins over the local parent chain.
      const handle = createRemoteActorRef(resolvedActorScope.system, {
        id: actorId,
        address: actorData.address,
        src: actorData.src,
        parent: resolvedActorScope.self,
        registryKey: actorData.registryKey,
        syncSnapshot: actorData.syncSnapshot,
        incarnation: actorData.incarnation
      });
      if (actorData.registryKey) {
        resolvedActorScope.system._set(actorData.registryKey, handle);
      }
      children[actorId] = handle;
      continue;
    }

    const childState = actorData.snapshot;
    const src = actorData.src;

    const logic = childLogics.get(actorId)!;

    const actor = resolvedActorScope.system.createActorRef(logic, {
      id: actorId,
      parent: resolvedActorScope.self,
      syncSnapshot: actorData.syncSnapshot,
      ...(childState !== undefined
        ? { _restore: createRestoreHook(logic, childState) }
        : {}),
      src,
      registryKey: actorData.registryKey
    });
    // Mark so `start()` knows to start this child (freshly invoked/spawned
    // children are started via deferred `@xstate.start` actions instead).
    (actor as any)._rehydrated = true;
    if (src === undefined) {
      (actor as any)._invoked = true;
    }

    children[actorId] = actor;
  }

  const timers: LogicalTimer[] = [];
  const persistedTimers: Array<{
    id?: string;
    seq?: number;
    delay: number;
    type: '@xstate.raise' | '@xstate.sendTo';
    event: EventObject;
    target: string | { type: 'parent' };
    scheduledAt?: number;
  }> = snapshotData.timers ?? [];
  for (const timer of persistedTimers) {
    let event = timer.event;
    if (event.type === 'xstate.timeout.actor') {
      const actorId = (event as AnyEventObject).actorId as string;
      const child = children[actorId];
      if (child) {
        event = createInvokeTimeoutEvent(actorId, child.sessionId);
      }
    }
    const target =
      typeof timer.target === 'string'
        ? timer.target === 'self'
          ? 'self'
          : children[timer.target]
        : isSerializedActorRef(timer.target)
          ? (timer.target as unknown as AnyActor)
          : resolvedActorScope.self._parent;
    if (!target) {
      const targetDescription =
        typeof timer.target === 'string'
          ? timer.target
          : (timer.target as { type: string }).type;
      throw new InvalidSnapshotError(
        isDevelopment
          ? `Unable to restore timer ${timer.id !== undefined ? `'${timer.id}'` : `for event '${timer.event.type}'`}: target actor '${targetDescription}' is unavailable.`
          : xstateError(33, targetDescription)
      );
    }
    timers.push({ ...timer, event, target });
  }

  const reviveHistoryValue = (
    historyValue: Record<string, ({ id: string } | AnyStateNode)[]>
  ): HistoryValue => {
    if (!historyValue || typeof historyValue !== 'object') {
      return {};
    }
    const revived: HistoryValue = {};
    for (const key of Object.keys(historyValue)) {
      const arr = historyValue[key];

      for (const item of arr) {
        let resolved: AnyStateNode | undefined;

        if (item instanceof StateNode) {
          resolved = item;
        } else {
          try {
            resolved = machine.getStateNodeById(item.id);
          } catch {
            if (isDevelopment) {
              console.warn(`Could not resolve StateNode for id: ${item.id}`);
            }
          }
        }

        if (!resolved) {
          continue;
        }

        revived[key] ??= [];
        revived[key].push(resolved);
      }
    }
    return revived;
  };

  const revivedHistoryValue = reviveHistoryValue(snapshotData.historyValue);

  if (isDevelopment && snapshotData.status === 'active') {
    // Restored snapshots are opaque: eventless transitions are not
    // re-evaluated on restore. Detected structurally; guards never run.
    const eventlessNode = nodes.find(
      (node) => node.always?.length || node.type === 'choice'
    );
    if (eventlessNode) {
      console.warn(
        `Restored snapshot is in state "${eventlessNode.id}" which has eventless transitions; they are not re-evaluated until the next event`
      );
    }
  }

  const {
    version: _persistedSnapshotVersion,
    // The legacy system-wide counter: superseded by per-snapshot
    // `_nextActorIds` plus the child-id fold below; dropped so old and new
    // snapshots round-trip to the same shape.
    _nextActorId: _legacyNextActorId,
    ...persistedRest
  } = snapshot as any;
  // Fold generated-shaped child ids into the counters as a floor: snapshots
  // persisted before per-actor counters (or hand-crafted ones) still must
  // never reuse a live child's id.
  let restoredCounters: Record<string, number> | undefined =
    persistedRest._nextActorIds;
  for (const childId of Object.keys(snapshotChildren)) {
    const generated = parseGeneratedActorId(childId);
    if (
      generated &&
      (restoredCounters?.[generated.prefix] ?? 0) <= generated.index
    ) {
      restoredCounters = {
        ...restoredCounters,
        [generated.prefix]: generated.index + 1
      };
    }
  }
  // Revive actor-ref references into a copy: the persisted snapshot is
  // caller-owned and is never mutated or frozen. Only plain objects and
  // arrays are copied; other values are kept as is.
  const revived = new Map<object, unknown>();

  function reviveContext(value: any, isRoot = false): any {
    if (!value || typeof value !== 'object') {
      return value;
    }
    // The context object itself is data, never a serialized actor ref.
    // Only an object whose keys are exactly `$actor` (+ `incarnation`)
    // is a serialized ref; any other object is data.
    if (!isRoot && isSerializedActorRef(value)) {
      // A ref that names one of this snapshot's children revives to that
      // child; restored children are new incarnations, so a ref pinned to
      // an incarnation stays data. Any other ref (e.g. a `replyTo` from an
      // event) stays data and routes by address.
      if (value.incarnation !== undefined) {
        return value;
      }
      return (
        Object.values(children).find(
          (child) => child.address === value.$actor
        ) ?? value
      );
    }
    const proto = Object.getPrototypeOf(value);
    if (!Array.isArray(value) && proto !== Object.prototype && proto !== null) {
      return value;
    }
    let copy: any = revived.get(value);
    if (!copy) {
      revived.set(
        value,
        (copy = Array.isArray(value) ? [] : Object.create(proto))
      );
      for (const key of Object.keys(value)) {
        // defineProperty keeps keys like `__proto__` as own data properties.
        Object.defineProperty(copy, key, {
          value: reviveContext(value[key]),
          writable: true,
          enumerable: true,
          configurable: true
        });
      }
    }
    return copy;
  }

  const restoredSnapshot = createMachineSnapshot(
    {
      ...persistedRest,
      context: reviveContext(persistedRest.context, true),
      children,
      timers,
      _nextActorIds: restoredCounters,
      _nodes: nodes,
      // Derived from the resolved configuration, so a partial value such as
      // `{ active: {} }` is completed with initial states and agrees with
      // `nodes`.
      value: undefined,
      historyValue: revivedHistoryValue,
      // Inputs only belong to active states; drop any others.
      _stateInputs: Object.fromEntries(
        Object.entries(snapshotData.stateInputs ?? {}).filter(([id]) =>
          nodes.some((node) => node.id === id)
        )
      )
    },
    machine,
    resolvedActorScope.self
  ) as AnyMachineSnapshot;

  if (usesInertScope) {
    setInertActorScopeSnapshot(resolvedActorScope, restoredSnapshot, false);
    return attachSnapshotActorRef(
      resolvedActorScope,
      restoredSnapshot
    ) as SnapshotFrom<TMachine>;
  }

  if (!isInertActorScope(resolvedActorScope)) {
    setSnapshotActorRef(
      restoredSnapshot,
      resolvedActorScope.self,
      resolvedActorScope.system
    );
  }
  return restoredSnapshot as SnapshotFrom<TMachine>;
}
