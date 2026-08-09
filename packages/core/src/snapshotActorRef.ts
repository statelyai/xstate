import type { AnyActor, Snapshot } from './types.ts';

/** Snapshot-scoped actor identity and system view. @internal */
export interface SnapshotActorRef {
  actor: AnyActor;
  systemState: SnapshotSystemState;
}

interface SnapshotSystemState {
  root?: AnyActor;
  children?: Map<string, AnyActor>;
  keyedActors: Map<PropertyKey, AnyActor | undefined>;
  snapshot: AnyActor['system']['_snapshot'];
  sourceSystem: AnyActor['system'];
  sourceVersion: number;
}

const snapshotActorRefs = new WeakMap<object, SnapshotActorRef>();
const emptyKeyedActors = new Map<PropertyKey, AnyActor | undefined>();

function copyRegisteredActors(
  system: AnyActor['system'],
  state?: SnapshotSystemState
): Map<string, AnyActor> {
  if (state) {
    const children = new Map<string, AnyActor>(state.children);
    if (state.root?.sessionId) {
      children.set(state.root.sessionId, state.root);
    }
    return children;
  }
  return new Map(system.children);
}

function captureRegisteredActors(system: AnyActor['system']): {
  root?: AnyActor;
  children?: Map<string, AnyActor>;
} {
  const root = system._getRootActor?.();
  const peekedChildren = system._peekChildren?.();
  if (!root && !peekedChildren) {
    if (system._getRootActor && system._peekChildren) {
      return {};
    }
    const children = new Map<string, AnyActor>(system.children);
    return children.size ? { children } : {};
  }
  if (!peekedChildren?.size) {
    return root ? { root } : {};
  }
  return { children: new Map<string, AnyActor>(system.children) };
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

function getSystemSnapshotVersion(system: AnyActor['system']): number {
  return system._snapshotVersion;
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
  const registeredActors = copyRegisteredActors(baseSystem, baseState);
  const keyedActors = new Map<PropertyKey, AnyActor | undefined>(
    baseState?.keyedActors ?? getKeyedActors(baseSystem)
  );
  const reverseKeyedActors = new WeakMap<AnyActor, PropertyKey>();
  const system: AnyActor['system'] = Object.assign(Object.create(baseSystem), {
    children: registeredActors,
    keyedActors,
    reverseKeyedActors,
    _snapshot: { ...(baseState?.snapshot ?? baseSystem._snapshot) },
    _snapshotVersion: baseState?.sourceVersion ?? baseSystem._snapshotVersion,
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
    // Pure transition resolution must not leak topology inspection events into
    // a live runtime system.
    _sendInspectionEvent: () => {}
  });

  for (const [registryKey, actor] of keyedActors) {
    if (!actor) {
      continue;
    }
    reverseKeyedActors.set(actor, registryKey);
  }
  for (const actor of Object.values(children)) {
    if (!actor) {
      continue;
    }
    if (actor.sessionId) {
      registeredActors.set(actor.sessionId, actor);
    }
    const registryKey = actor.registryKey;
    if (registryKey) {
      keyedActors.set(registryKey, actor);
      reverseKeyedActors.set(actor, registryKey);
    }
  }

  return system;
}

/** Returns the actor identity associated with a transition snapshot. @internal */
export function getSnapshotActorRef(
  snapshot: Snapshot<unknown>
): SnapshotActorRef | undefined {
  return snapshotActorRefs.get(snapshot);
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
  const ref = getSnapshotActorRef(source);
  if (ref) {
    snapshotActorRefs.set(target, ref);
  }
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
  const sourceVersion = getSystemSnapshotVersion(baseSystem);
  const previousRef = previousSnapshot
    ? getSnapshotActorRef(previousSnapshot)
    : undefined;
  const reusableRef =
    previousRef?.actor === actor ? previousRef : getSnapshotActorRef(snapshot);

  if (
    reusableRef?.actor === actor &&
    reusableRef.systemState.sourceSystem === baseSystem &&
    reusableRef.systemState.sourceVersion === sourceVersion
  ) {
    snapshotActorRefs.set(snapshot, reusableRef);
    return;
  }

  const capturedActors = captureRegisteredActors(baseSystem);
  let children = capturedActors.children;
  const baseKeyedActors = getKeyedActors(baseSystem);
  let keyedActors = baseKeyedActors.size
    ? new Map(baseKeyedActors)
    : emptyKeyedActors;
  for (const child of Object.values(getSnapshotChildren(snapshot))) {
    if (!child) {
      continue;
    }
    if (child.sessionId) {
      (children ??= new Map()).set(child.sessionId, child);
    }
    const registryKey = child.registryKey;
    if (registryKey) {
      if (keyedActors === emptyKeyedActors) {
        keyedActors = new Map();
      }
      keyedActors.set(registryKey, child);
    }
  }
  snapshotActorRefs.set(snapshot, {
    actor,
    systemState: {
      ...capturedActors,
      children,
      keyedActors,
      snapshot: { ...baseSystem._snapshot },
      sourceSystem: baseSystem,
      sourceVersion
    }
  } satisfies SnapshotActorRef);
}
