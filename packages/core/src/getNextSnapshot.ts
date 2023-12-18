import { createEmptyActor } from './actors/index.ts';
import {
  AnyActorLogic,
  AnyActorScope,
  EventFromLogic,
  SnapshotFrom
} from './types.ts';

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
  snapshot: SnapshotFrom<T> | undefined,
  event: EventFromLogic<T>
): any {
  const self = createEmptyActor();
  const inertActorScope: AnyActorScope = {
    self,
    defer: () => {},
    id: '',
    logger: () => {},
    sessionId: '',
    stopChild: () => {},
    system: self.system
  };
  const resolvedSnapshot =
    snapshot ?? actorLogic.getInitialSnapshot(inertActorScope, null as any);
  return actorLogic.transition(resolvedSnapshot, event, inertActorScope);
}
