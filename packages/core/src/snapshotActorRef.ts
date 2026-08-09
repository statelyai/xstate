import type { AnyActor, Snapshot } from './types.ts';

/** Snapshot-scoped actor identity and system view. @internal */
export interface SnapshotActorRef {
  actor: AnyActor;
  systemState: SnapshotSystemState;
}

interface SnapshotSystemState {
  children: Map<string, AnyActor>;
  keyedActors: Map<any, AnyActor>;
  snapshot: AnyActor['system']['_snapshot'];
  sourceSystem: AnyActor['system'];
  sourceVersion: number;
}

const snapshotActorRefs = new WeakMap<object, SnapshotActorRef>();

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
  const registeredActors = new Map(baseState?.children ?? baseSystem.children);
  const keyedActors = new Map<any, AnyActor>(
    baseState?.keyedActors ?? baseSystem.keyedActors
  );
  const reverseKeyedActors = new WeakMap<AnyActor, any>();
  const system: AnyActor['system'] = {
    ...baseSystem,
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
    _set: (registryKey: any, actor: AnyActor) => {
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
    get: (registryKey: any) => keyedActors.get(registryKey) as any,
    getAll: () => Object.fromEntries(keyedActors),
    // Pure transition resolution must not leak topology inspection events into
    // a live runtime system.
    _sendInspectionEvent: () => {}
  };

  for (const [registryKey, actor] of keyedActors) {
    reverseKeyedActors.set(actor, registryKey);
  }
  for (const actor of Object.values(children)) {
    if (!actor) {
      continue;
    }
    if (actor.sessionId) {
      registeredActors.set(actor.sessionId, actor);
    }
    const registryKey = (actor as any).registryKey;
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

  const system = createSnapshotSystem(
    baseSystem,
    getSnapshotChildren(snapshot)
  );
  snapshotActorRefs.set(snapshot, {
    actor,
    systemState: {
      children: system.children,
      keyedActors: system.keyedActors as Map<any, AnyActor>,
      snapshot: system._snapshot,
      sourceSystem: baseSystem,
      sourceVersion
    }
  } satisfies SnapshotActorRef);
}
