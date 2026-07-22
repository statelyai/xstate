import type { AnyActor, Snapshot } from './types.ts';

/** @internal */
export const snapshotActorRef = Symbol('xstate.snapshotActorRef');

/** Snapshot-scoped actor identity and system view. @internal */
export interface SnapshotActorRef {
  actor: AnyActor;
  systemState: SnapshotSystemState;
}

interface SnapshotSystemState {
  children: Map<string, AnyActor>;
  keyedActors: Map<any, AnyActor>;
  snapshot: AnyActor['system']['_snapshot'];
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
  self: AnyActor,
  children: Record<string, AnyActor | undefined>,
  baseState?: SnapshotSystemState
): AnyActor['system'] {
  const registeredActors = new Map(baseState?.children ?? baseSystem.children);
  const keyedActors = new Map<any, AnyActor>(
    baseState?.keyedActors ??
      Object.entries(
        baseSystem.getAll() as Record<string, AnyActor | undefined>
      ).filter((entry): entry is [string, AnyActor] => !!entry[1])
  );
  const reverseKeyedActors = new WeakMap<AnyActor, any>();
  let booksSelf = true;

  const system: AnyActor['system'] = {
    ...baseSystem,
    children: registeredActors,
    keyedActors,
    reverseKeyedActors,
    _snapshot: { ...(baseState?.snapshot ?? baseSystem._snapshot) },
    _bookId: () => {
      if (booksSelf) {
        booksSelf = false;
        return self.sessionId ?? self.id;
      }
      return `x:${system._snapshot._nextActorId++}`;
    },
    _register: (sessionId: string, actor: AnyActor) => {
      registeredActors.set(sessionId, actor);
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
  return (snapshot as any)[snapshotActorRef];
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
    Object.defineProperty(target, snapshotActorRef, {
      configurable: true,
      value: ref
    });
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
  baseSystem: AnyActor['system'] = actor.system
): void {
  const system = createSnapshotSystem(
    baseSystem,
    actor,
    getSnapshotChildren(snapshot)
  );
  Object.defineProperty(snapshot, snapshotActorRef, {
    configurable: true,
    value: {
      actor,
      systemState: {
        children: system.children,
        keyedActors: system.keyedActors as Map<any, AnyActor>,
        snapshot: system._snapshot
      }
    } satisfies SnapshotActorRef
  });
}
