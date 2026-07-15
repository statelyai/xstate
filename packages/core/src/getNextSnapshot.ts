import { createActor } from './createActor.ts';
import {
  getMachineSnapshotActorRef,
  isMachineSnapshot,
  setMachineSnapshotActorRef
} from './State.ts';
import {
  ActorScope,
  AnyActor,
  AnyActorLogic,
  AnyActorScope,
  EmittedFrom,
  EventFromLogic,
  InputFrom,
  SnapshotFrom
} from './types.ts';

function collectSnapshotActors(
  children: Record<string, AnyActor | undefined>
): AnyActor[] {
  return Object.values(children).filter(Boolean) as AnyActor[];
}

/**
 * Creates the isolated receptionist/id view used by a pure branch. Scheduling,
 * relaying and clocks remain delegated to the snapshot's execution system.
 */
function createSystemProjection(
  previousSelf: AnyActor,
  children: Record<string, AnyActor | undefined>
): AnyActor['system'] {
  const baseSystem = previousSelf.system;
  const registeredActors = new Map<string, AnyActor>();
  const keyedActors = new Map<any, AnyActor>();
  const reverseKeyedActors = new WeakMap<AnyActor, any>();
  const actors = collectSnapshotActors(children);
  let booksRoot = true;

  const system: AnyActor['system'] = {
    ...baseSystem,
    children: registeredActors,
    keyedActors,
    reverseKeyedActors,
    _snapshot: { ...baseSystem._snapshot },
    _bookId: () => {
      if (booksRoot) {
        booksRoot = false;
        return previousSelf.sessionId ?? previousSelf.id;
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

  for (const [sessionId, actor] of baseSystem.children) {
    registeredActors.set(sessionId, actor);
  }
  for (const [registryKey, actor] of Object.entries(
    baseSystem.getAll() as Record<string, AnyActor | undefined>
  )) {
    if (actor) {
      keyedActors.set(registryKey, actor);
      reverseKeyedActors.set(actor, registryKey);
    }
  }
  for (const actor of actors) {
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

/** @internal */
export function setInertActorScopeSnapshot<T>(
  actorScope: AnyActorScope,
  snapshot: T,
  attachActorRef = true
): T {
  (actorScope.self as any)._snapshot = snapshot;
  if (attachActorRef && isMachineSnapshot(snapshot)) {
    setMachineSnapshotActorRef(snapshot, actorScope.self);
  }
  return snapshot;
}

/** @internal */
export function isInertActorScope(actorScope: AnyActorScope): boolean {
  return !!(actorScope.self as any).options?._inert;
}

/** @internal */
export function attachSnapshotActorRef<T extends AnyActorLogic, TSnapshot>(
  actorLogic: T,
  actorScope: AnyActorScope,
  snapshot: TSnapshot
): TSnapshot {
  const snapshotScope = createInertActorScope(
    actorLogic,
    snapshot as SnapshotFrom<T>,
    actorScope.self
  );
  return setInertActorScopeSnapshot(snapshotScope, snapshot);
}

/** @internal */
export function createInertActorScope<T extends AnyActorLogic>(
  actorLogic: T,
  snapshot?: SnapshotFrom<T>,
  sourceSelf?: AnyActor
): AnyActorScope {
  const previousSelf =
    sourceSelf ??
    (isMachineSnapshot(snapshot)
      ? getMachineSnapshotActorRef(snapshot)
      : undefined);
  const system =
    previousSelf && isMachineSnapshot(snapshot)
      ? createSystemProjection(previousSelf, (snapshot as any).children)
      : undefined;
  const self = createActor(
    actorLogic as AnyActorLogic,
    {
      _inert: true,
      ...(system ? { _systemRef: { current: system } } : {})
    } as any
  );
  if (previousSelf?._parent) {
    self._parent = previousSelf._parent;
  }
  if (snapshot) {
    (self as any)._snapshot = snapshot;
  }

  const actorScope: ActorScope<
    SnapshotFrom<T>,
    EventFromLogic<T>,
    any,
    EmittedFrom<T>
  > = {
    self: self as any,
    defer: () => {},
    id: self.id,
    logger: self.system._logger,
    sessionId: self.sessionId,
    stopChild: (child) => (child as any)._stop(),
    system: self.system,
    emit: (event) => (self as any)._emit(event),
    actionExecutor: () => {}
  };
  return actorScope;
}

/** @deprecated Use `initialTransition(…)` instead. */
export function getInitialSnapshot<T extends AnyActorLogic>(
  actorLogic: T,
  ...[input]: undefined extends InputFrom<T>
    ? [input?: InputFrom<T>]
    : [input: InputFrom<T>]
): SnapshotFrom<T> {
  const actorScope = createInertActorScope(actorLogic);
  return actorLogic.initialTransition(input, actorScope)[0];
}

/**
 * Determines the next snapshot for the given `actorLogic` based on the given
 * `snapshot` and `event`.
 *
 * If the `snapshot` is `undefined`, the initial snapshot of the `actorLogic` is
 * used.
 *
 * @deprecated Use `transition(…)` instead.
 * @example
 *
 * ```ts
 * import { getNextSnapshot } from 'xstate';
 * import { trafficLightMachine } from './trafficLightMachine.ts';
 *
 * const nextSnapshot = getNextSnapshot(
 *   trafficLightMachine, // actor logic
 *   undefined, // snapshot (or initial state if undefined)
 *   { type: 'TIMER' }
 * ); // event object
 *
 * console.log(nextSnapshot.value);
 * // => 'yellow'
 *
 * const nextSnapshot2 = getNextSnapshot(
 *   trafficLightMachine, // actor logic
 *   nextSnapshot, // snapshot
 *   { type: 'TIMER' }
 * ); // event object
 *
 * console.log(nextSnapshot2.value);
 * // =>'red'
 * ```
 */
export function getNextSnapshot<T extends AnyActorLogic>(
  actorLogic: T,
  snapshot: SnapshotFrom<T>,
  event: EventFromLogic<T>
): SnapshotFrom<T> {
  const actorScope = createInertActorScope(actorLogic, snapshot);
  const transitionResult = actorLogic.transition(snapshot, event, actorScope);
  const nextSnapshot = Array.isArray(transitionResult)
    ? transitionResult[0]
    : transitionResult;
  setInertActorScopeSnapshot(actorScope, nextSnapshot, false);
  return nextSnapshot === snapshot
    ? nextSnapshot
    : attachSnapshotActorRef(actorLogic, actorScope, nextSnapshot);
}
