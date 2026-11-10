import isDevelopment from '#is-development';
import { hasAmbientInspector } from './inspectionAmbient.ts';
import { xstateError } from './xstateError.ts';
import type { ActorSystemRuntime } from './system.ts';
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

// Each view's execution system and whether it forwards inspection. Views
// never chain: they all inherit from the execution system directly.
const snapshotSystemViews = new WeakMap<
  AnyActor['system'],
  {
    executionSystem: AnyActor['system'];
    rootSystem: AnyActor['system'];
    forwardInspection: boolean;
  }
>();
// Facilities owned by the execution rather than by one snapshot's view. A view
// reads and writes them on the execution system, so timers, listeners and the
// runtime installed through any snapshot are visible through every other.
const executionFacilities = [
  'runtime',
  '_timerMap',
  '_rejectionListeners',
  '_inspectionObservers',
  '_emissionListeners'
] as const;
// The durable execution that owns each execution system.
/** A durable execution, as the owner of the views its transitions create. @internal */
export interface ExecutionOwner {
  runtime: Partial<ActorSystemRuntime> | undefined;
}
const executionOwners = new WeakMap<AnyActor['system'], ExecutionOwner>();
let ambientExecutionOwner: ExecutionOwner | undefined;
const snapshotActorRefs = new WeakMap<object, SnapshotActorRef>();
const lazySnapshotActorRefs = new WeakMap<object, () => SnapshotActorRef>();
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
  baseState?: SnapshotSystemState,
  owner?: ExecutionOwner
): AnyActor['system'] {
  const baseView = snapshotSystemViews.get(baseSystem);
  const baseExecutionSystem = baseView?.executionSystem ?? baseSystem;
  // The runtime system under every view. A view runs its methods against the
  // execution system's facilities.
  const rootSystem = baseView?.rootSystem ?? baseSystem;
  const forks =
    owner !== undefined && executionOwners.get(baseExecutionSystem) !== owner;
  const forwardInspection =
    hasAmbientInspector() && (baseView?.forwardInspection ?? true);
  const registeredActors = copyRegisteredActors(baseSystem, baseState);
  const keyedActors = new Map<PropertyKey, AnyActor | undefined>(
    baseState?.keyedActors ?? getKeyedActors(baseSystem)
  );
  const reverseKeyedActors = new WeakMap<AnyActor, PropertyKey>();
  // A forked view is its own execution system.
  const execution = () => (forks ? system : baseExecutionSystem);
  const system: AnyActor['system'] = Object.assign(
    Object.create(baseExecutionSystem),
    {
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
        if (
          registryKey !== undefined &&
          keyedActors.get(registryKey) === actor
        ) {
          keyedActors.delete(registryKey);
        }
        reverseKeyedActors.delete(actor);
        markSystemSnapshotDirty(system);
      },
      _set: (registryKey: PropertyKey, actor: AnyActor) => {
        const existing = keyedActors.get(registryKey);
        if (existing && existing !== actor) {
          throw new Error(
            isDevelopment
              ? `Actor with registry key '${String(registryKey)}' already exists.`
              : xstateError(45, String(registryKey))
          );
        }
        keyedActors.set(registryKey, actor);
        reverseKeyedActors.set(actor, registryKey);
        markSystemSnapshotDirty(system);
      },
      get: (registryKey: PropertyKey) => keyedActors.get(registryKey),
      getAll: () => Object.fromEntries(keyedActors),
      onEmitted: (listener: Parameters<AnyActor['system']['onEmitted']>[0]) =>
        rootSystem.onEmitted.call(execution(), listener),
      _notifyEmitted: (
        actorRef: AnyActor,
        event: Parameters<AnyActor['system']['_notifyEmitted']>[1]
      ) => rootSystem._notifyEmitted.call(execution(), actorRef, event),
      // Pure transition resolution must not leak topology inspection events
      // into a live runtime system — planning branches stay silent. The one
      // exception is a durable execution's own transitions (marked by the
      // ambient inspector at creation time): there the pure path IS the
      // execution, so inspection forwards to the execution system's observers.
      _hasInspectionObservers: forwardInspection
        ? () => rootSystem._hasInspectionObservers?.call(execution()) ?? false
        : () => false,
      _sendInspectionEvent: forwardInspection
        ? (event: Parameters<AnyActor['system']['_sendInspectionEvent']>[0]) =>
            rootSystem._sendInspectionEvent.call(execution(), event)
        : () => {}
    }
  );

  const executionSystem = forks ? system : baseExecutionSystem;
  for (const key of executionFacilities) {
    if (forks && key === 'runtime') {
      system.runtime = owner.runtime;
    } else if (forks) {
      const value = (baseExecutionSystem as any)[key];
      (system as any)[key] =
        value instanceof Set
          ? new Set(value)
          : key === '_timerMap' && value
            ? { ...value }
            : value;
    } else {
      Object.defineProperty(system, key, {
        get: () => (executionSystem as any)[key],
        set: (value) => {
          (executionSystem as any)[key] = value;
        }
      });
    }
  }
  if (forks) {
    executionOwners.set(system, owner!);
  }
  snapshotSystemViews.set(system, {
    executionSystem,
    rootSystem,
    forwardInspection
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

/**
 * Runs `fn` as a transition of `owner`. A view it derives from a system the
 * owner does not own forks: it gets the owner's runtime and copies of the
 * timers and listeners it saw, so executions that adopt the same snapshot
 * never share them.
 *
 * @internal
 */
export function withExecutionOwner<T>(owner: ExecutionOwner, fn: () => T): T {
  const previous = ambientExecutionOwner;
  ambientExecutionOwner = owner;
  try {
    return fn();
  } finally {
    ambientExecutionOwner = previous;
  }
}

/** Hands the ambient owner to the first scope that asks for it. @internal */
export function takeExecutionOwner(): ExecutionOwner | undefined {
  const owner = ambientExecutionOwner;
  ambientExecutionOwner = undefined;
  return owner;
}

/** Returns the actor identity associated with a transition snapshot. @internal */
export function getSnapshotActorRef(
  snapshot: Snapshot<unknown>
): SnapshotActorRef | undefined {
  const existing = snapshotActorRefs.get(snapshot);
  if (existing) {
    return existing;
  }
  const create = lazySnapshotActorRefs.get(snapshot);
  if (!create) {
    return undefined;
  }
  const created = create();
  snapshotActorRefs.set(snapshot, created);
  lazySnapshotActorRefs.delete(snapshot);
  return created;
}

/** Reads an already materialized snapshot association without creating one. @internal */
export function peekSnapshotActorRef(
  snapshot: Snapshot<unknown>
): SnapshotActorRef | undefined {
  return snapshotActorRefs.get(snapshot);
}

/** Returns the existing identity provider without resolving it. @internal */
export function getSnapshotActorRefProvider(
  snapshot: Snapshot<unknown>
): (() => SnapshotActorRef) | undefined {
  const existing = snapshotActorRefs.get(snapshot);
  return existing ? () => existing : lazySnapshotActorRefs.get(snapshot);
}

/** Defers actor/system identity allocation until a snapshot capability is used. @internal */
export function setLazySnapshotActorRef(
  snapshot: Snapshot<unknown>,
  create: () => SnapshotActorRef
): void {
  snapshotActorRefs.delete(snapshot);
  lazySnapshotActorRefs.set(snapshot, create);
}

/**
 * Copies an internal actor association without rebuilding its system view.
 *
 * @internal
 */
export function copySnapshotActorRef(
  source: Snapshot<unknown>,
  target: Snapshot<unknown>
): boolean {
  const ref = snapshotActorRefs.get(source);
  if (ref) {
    snapshotActorRefs.set(target, ref);
    return true;
  }
  const create = lazySnapshotActorRefs.get(source);
  if (create) {
    lazySnapshotActorRefs.set(target, create);
    return true;
  }
  return false;
}

/** Refreshes the only topology change made by an otherwise idle root start. */
export function refreshSnapshotActorRefRoot(
  snapshot: Snapshot<unknown>,
  actor: AnyActor,
  system: AnyActor['system']
): boolean {
  const ref = snapshotActorRefs.get(snapshot);
  const sourceVersion = getSystemSnapshotVersion(system);
  if (
    ref?.actor !== actor ||
    ref.systemState.sourceSystem !== system ||
    ref.systemState.sourceVersion + 1 !== sourceVersion ||
    system._getRootActor?.() !== actor ||
    system._peekChildren?.()
  ) {
    return false;
  }
  ref.systemState.root = actor;
  ref.systemState.sourceVersion = sourceVersion;
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
  lazySnapshotActorRefs.delete(snapshot);
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
