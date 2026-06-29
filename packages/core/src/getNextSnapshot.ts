import { createActor } from './createActor.ts';
import { createSystem } from './system.ts';
import {
  ActorScope,
  AnyActorLogic,
  AnyActorScope,
  EmittedFrom,
  EventFromLogic,
  InputFrom,
  SnapshotFrom
} from './types.ts';

/** @internal */
export function createInertActorScope<T extends AnyActorLogic>(
  actorLogic: T
): AnyActorScope {
  const self = createActor(actorLogic as AnyActorLogic);
  // The Actor constructor eagerly calls `getInitialSnapshot` during `_initState`,
  // which can register child actors with `systemId` in `self.system`.
  // Replace `self.system` with a fresh system so that child actors spawned by
  // the *caller's* explicit `getInitialSnapshot` / `transition` call register
  // into a clean system and do not collide with those from the eager
  // construction call.  This is what makes `initialTransition(machine)` safe
  // even when invoked actors carry a `systemId`.
  const freshSystem = createSystem(self, {
    clock: self.system._clock,
    logger: self.system._logger
  });
  (self as any).system = freshSystem;
  const inertActorScope: ActorScope<
    SnapshotFrom<T>,
    EventFromLogic<T>,
    any,
    EmittedFrom<T>
  > = {
    self,
    defer: () => {},
    id: '',
    logger: () => {},
    sessionId: '',
    stopChild: () => {},
    system: freshSystem,
    emit: () => {},
    actionExecutor: () => {}
  };

  return inertActorScope;
}

/** @deprecated Use `initialTransition(…)` instead. */
export function getInitialSnapshot<T extends AnyActorLogic>(
  actorLogic: T,
  ...[input]: undefined extends InputFrom<T>
    ? [input?: InputFrom<T>]
    : [input: InputFrom<T>]
): SnapshotFrom<T> {
  const actorScope = createInertActorScope(actorLogic);
  return actorLogic.getInitialSnapshot(actorScope, input);
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
  const inertActorScope = createInertActorScope(actorLogic);
  (inertActorScope.self as any)._snapshot = snapshot;
  return actorLogic.transition(snapshot, event, inertActorScope);
}
