import { createActor } from './createActor.ts';
import { isMachineSnapshot } from './State.ts';
import {
  createSnapshotSystem,
  getSnapshotActorRef,
  setSnapshotActorRef
} from './snapshotActorRef.ts';
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

/** @internal */
export function setInertActorScopeSnapshot<T>(
  actorScope: AnyActorScope,
  snapshot: T,
  attachActorRef = true
): T {
  (actorScope.self as any)._snapshot = snapshot;
  if (attachActorRef && snapshot && typeof snapshot === 'object') {
    setSnapshotActorRef(snapshot as any, actorScope.self);
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
  const snapshotRef = snapshot ? getSnapshotActorRef(snapshot) : undefined;
  const previousSelf = sourceSelf ?? snapshotRef?.actor;
  const baseSystem = previousSelf?.system;
  const system =
    previousSelf && baseSystem
      ? createSnapshotSystem(
          baseSystem,
          previousSelf,
          isMachineSnapshot(snapshot) ? (snapshot as any).children : {},
          sourceSelf ? undefined : snapshotRef?.systemState
        )
      : undefined;
  const self = createActor(
    actorLogic as AnyActorLogic,
    {
      _inert: true,
      ...(previousSelf ? { id: previousSelf.id } : {}),
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
    emit: (event) => self.system.emitEvent(self, event),
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
