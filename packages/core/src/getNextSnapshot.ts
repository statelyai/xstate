import { createActor } from './createActor.ts';
import {
  ActorScope,
  AnyActorLogic,
  AnyActorScope,
  EventFromLogic,
  InputFrom,
  SnapshotFrom
} from './types.ts';

/** @internal */
export function createInertActorScope<T extends AnyActorLogic>(
  actorLogic: T
): AnyActorScope {
  const self = createActor(actorLogic as AnyActorLogic);
  const inertActorScope: ActorScope<SnapshotFrom<T>, EventFromLogic<T>, any> = {
    self,
    defer: () => {},
    id: '',
    logger: () => {},
    sessionId: '',
    stopChild: () => {},
    system: self.system,
    spawnChild: (logic) => {
      const child = createActor(logic) as any;

      return child;
    }
  };

  return inertActorScope;
}

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
 * Determines the next snapshot for the given `actorLogic` based on
 * the given `snapshot` and `event`.
 *
 * If the `snapshot` is `undefined`, the initial snapshot of the
 * `actorLogic` is used.
 *
 * @example
  ```ts
  import { getNextSnapshot } from 'xstate';
  import { trafficLightMachine } from './trafficLightMachine.ts';

  const nextSnapshot = getNextSnapshot(
    trafficLightMachine, // actor logic
    undefined, // snapshot (or initial state if undefined)
    { type: 'TIMER' }); // event object

  console.log(nextSnapshot.value);
  // => 'yellow'

  const nextSnapshot2 = getNextSnapshot(
    trafficLightMachine, // actor logic
    nextSnapshot, // snapshot
    { type: 'TIMER' }); // event object

  console.log(nextSnapshot2.value);
  // =>'red'
  ```
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
