import { hasAmbientInspector } from './inspectionAmbient.ts';
import type { AnyActor, Snapshot } from './types.ts';

/** Snapshot-scoped actor identity and system view. @internal */
export interface SnapshotActorRef {
  actor: AnyActor;
  systemState: SnapshotSystemState;
}

interface SnapshotSystemState {
  children: Map<string, AnyActor>;
  keyedActors: Map<PropertyKey, AnyActor | undefined>;
  snapshot: AnyActor['system']['_snapshot'];
  y: AnyActor['system'];
  v: number;
}

const snapshotActorRefs = new WeakMap<
  object,
  SnapshotActorRef | (() => SnapshotActorRef)
>();
const emptyKeyedActors = new Map<PropertyKey, AnyActor | undefined>();

function copyRegisteredActors(
  system: AnyActor['system'],
  state?: SnapshotSystemState
): Map<string, AnyActor> {
  const children = new Map<string, AnyActor>(
    (state?.children ??
      (system._peekChildren ? system._peekChildren() : system.children)) as Map<
      string,
      AnyActor
    >
  );
  const root = !state && system._getRootActor?.();
  if (root?.sessionId) {
    children.set(root.sessionId, root);
  }
  return children;
}

function getKeyedActors(
  system: AnyActor['system']
): Map<PropertyKey, AnyActor | undefined> {
  const peek = system._peekKeyedActors;
  if (peek) {
    return peek.call(system) ?? emptyKeyedActors;
  }
  return system.keyedActors;
}

/** Marks topology or persisted runtime state as changed. @internal */
export function markSystemSnapshotDirty(system: AnyActor['system']): void {
  system._snapshotVersion++;
}

function getSnapshotChildren(
  snapshot: Snapshot<unknown>
): Record<string, AnyActor | undefined> {
  return 'children' in snapshot && snapshot.children
    ? (snapshot.children as Record<string, AnyActor | undefined>)
    : {};
}

/**
 * Creates the isolated receptionist/id view used by a pure branch. Scheduling,
 * relaying and clocks remain delegated to the snapshot's execution system.
 *
 * @internal
 */
export function createSnapshotSystem(
  baseSystem: AnyActor['system'],
  children: Record<string, AnyActor | undefined>,
  baseState?: SnapshotSystemState
): AnyActor['system'] {
  const forwardInspection = hasAmbientInspector();
  const registeredActors = copyRegisteredActors(baseSystem, baseState);
  const keyedActors = new Map<PropertyKey, AnyActor | undefined>(
    baseState?.keyedActors ?? getKeyedActors(baseSystem)
  );
  const reverseKeyedActors = new WeakMap<AnyActor, PropertyKey>();
  const system: AnyActor['system'] = Object.assign(Object.create(baseSystem), {
    _children: registeredActors,
    _keyedActors: keyedActors,
    _reverseKeyedActors: reverseKeyedActors,
    _snapshot: { ...(baseState?.snapshot ?? baseSystem._snapshot) },
    _snapshotVersion: baseState?.v ?? baseSystem._snapshotVersion,
    _register: (sessionId: string, actor: AnyActor) => {
      registeredActors.set(sessionId, actor);
      markSystemSnapshotDirty(system);
      return sessionId;
    },
    _unregister: (actor: AnyActor) => {
      if (actor.sessionId) {
        registeredActors.delete(actor.sessionId);
      }
      const registryKey = reverseKeyedActors.get(actor);
      if (registryKey !== undefined && keyedActors.get(registryKey) === actor) {
        keyedActors.delete(registryKey);
      }
      reverseKeyedActors.delete(actor);
      markSystemSnapshotDirty(system);
    },
    _set: (registryKey: PropertyKey, actor: AnyActor) => {
      const existing = keyedActors.get(registryKey);
      if (existing && existing !== actor) {
        throw new Error(
          `Actor with registry key '${String(registryKey)}' already exists.`
        );
      }
      keyedActors.set(registryKey, actor);
      reverseKeyedActors.set(actor, registryKey);
      markSystemSnapshotDirty(system);
    },
    get: (registryKey: PropertyKey) => keyedActors.get(registryKey),
    getAll: () => Object.fromEntries(keyedActors),
    // Pure transition resolution must not leak topology inspection events
    // into a live runtime system — planning branches stay silent. The one
    // exception is a durable execution's own transitions (marked by the
    // ambient inspector at creation time): there the pure path IS the
    // execution, so inspection forwards to the base system's observers.
    _hasInspectionObservers: forwardInspection
      ? () => baseSystem._hasInspectionObservers()
      : () => false,
    _sendInspectionEvent: forwardInspection
      ? (event: Parameters<AnyActor['system']['_sendInspectionEvent']>[0]) =>
          baseSystem._sendInspectionEvent(event)
      : () => {}
  });

  for (const [registryKey, actor] of keyedActors) {
    if (actor) {
      reverseKeyedActors.set(actor, registryKey);
    }
  }
  for (const actor of Object.values(children)) {
    if (actor) {
      if (actor.sessionId) {
        registeredActors.set(actor.sessionId, actor);
      }
      const registryKey = actor.registryKey;
      if (registryKey) {
        keyedActors.set(registryKey, actor);
        reverseKeyedActors.set(actor, registryKey);
      }
    }
  }

  return system;
}

/** Returns the actor identity associated with a transition snapshot. @internal */
export function getSnapshotActorRef(
  snapshot: Snapshot<unknown>
): SnapshotActorRef | undefined {
  const value = snapshotActorRefs.get(snapshot);
  if (typeof value !== 'function') {
    return value;
  }
  const ref = value();
  snapshotActorRefs.set(snapshot, ref);
  return ref;
}

/** Reads an already materialized snapshot association without creating one. @internal */
export function peekSnapshotActorRef(
  snapshot: Snapshot<unknown>
): SnapshotActorRef | undefined {
  const value = snapshotActorRefs.get(snapshot);
  return typeof value === 'function' ? undefined : value;
}

/** Returns the existing identity provider without resolving it. @internal */
export function getSnapshotActorRefProvider(
  snapshot: Snapshot<unknown>
): (() => SnapshotActorRef) | undefined {
  const value = snapshotActorRefs.get(snapshot);
  return typeof value === 'function' ? value : value ? () => value : undefined;
}

/** Defers actor/system identity allocation until a snapshot capability is used. @internal */
export function setLazySnapshotActorRef(
  snapshot: Snapshot<unknown>,
  create: () => SnapshotActorRef
): void {
  snapshotActorRefs.set(snapshot, create);
}

/**
 * Copies an internal actor association without rebuilding its system view.
 *
 * @internal
 */
export function copySnapshotActorRef(
  source: Snapshot<unknown>,
  target: Snapshot<unknown>
): void {
  const value = snapshotActorRefs.get(source);
  if (value) {
    snapshotActorRefs.set(target, value);
  }
}

/** Refreshes the only topology change made by an otherwise idle root start. */
export function refreshSnapshotActorRefRoot(
  snapshot: Snapshot<unknown>,
  actor: AnyActor,
  system: AnyActor['system']
): boolean {
  const ref = peekSnapshotActorRef(snapshot);
  const v = system._snapshotVersion;
  if (
    ref?.actor !== actor ||
    ref.systemState.y !== system ||
    ref.systemState.v + 1 !== v ||
    system._getRootActor?.() !== actor ||
    system._peekChildren?.()
  ) {
    return false;
  }
  ref.systemState.children.set(actor.sessionId!, actor);
  ref.systemState.v = v;
  return true;
}

/**
 * Associates a transition snapshot with an actor and an immutable system view.
 * The internal association is excluded from enumeration and persistence.
 *
 * @internal
 */
export function setSnapshotActorRef(
  snapshot: Snapshot<unknown>,
  actor: AnyActor,
  baseSystem: AnyActor['system'] = actor.system,
  previousSnapshot?: Snapshot<unknown>
): void {
  const ownRef = peekSnapshotActorRef(snapshot);
  if (!ownRef) {
    snapshotActorRefs.delete(snapshot);
  }
  const v = baseSystem._snapshotVersion;
  const previousRef = previousSnapshot
    ? getSnapshotActorRef(previousSnapshot)
    : undefined;
  const reusableRef = previousRef?.actor === actor ? previousRef : ownRef;
  if (
    reusableRef?.actor === actor &&
    reusableRef.systemState.y === baseSystem &&
    reusableRef.systemState.v === v
  ) {
    snapshotActorRefs.set(snapshot, reusableRef);
    return;
  }

  const children = copyRegisteredActors(baseSystem);
  const baseKeyedActors = getKeyedActors(baseSystem);
  let keyedActors = baseKeyedActors.size
    ? new Map(baseKeyedActors)
    : emptyKeyedActors;
  for (const child of Object.values(getSnapshotChildren(snapshot))) {
    if (child) {
      if (child.sessionId) {
        children.set(child.sessionId, child);
      }
      const registryKey = child.registryKey;
      if (registryKey) {
        if (keyedActors === emptyKeyedActors) {
          keyedActors = new Map();
        }
        keyedActors.set(registryKey, child);
      }
    }
  }
  snapshotActorRefs.set(snapshot, {
    actor,
    systemState: {
      children,
      keyedActors,
      snapshot: { ...baseSystem._snapshot },
      y: baseSystem,
      v
    }
  } satisfies SnapshotActorRef);
}
