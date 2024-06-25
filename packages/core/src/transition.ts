import { createInertActorScope } from './getNextSnapshot';
import { ExecutableAction } from './stateUtils';
import { AnyActorLogic, EventFrom, InputFrom, SnapshotFrom } from './types';

/**
 * Given actor `logic`, a `snapshot`, and an `event`, returns a
 * tuple of the `nextSnapshot` and `actions` to execute.
 *
 * This is a pure function that does not execute `actions`.
 */
export function transition<T extends AnyActorLogic>(
  logic: T,
  snapshot: SnapshotFrom<T>,
  event: EventFrom<T>
): [nextSnapshot: SnapshotFrom<T>, actions: ExecutableAction[]] {
  const executableActions = [] as ExecutableAction[];

  const actorScope = createInertActorScope(logic);
  actorScope.actionExecutor = (action) => {
    executableActions.push(action);
  };

  const nextSnapshot = logic.transition(snapshot, event, actorScope);

  return [nextSnapshot, executableActions];
}

/**
 * Given actor `logic` and optional `input`, returns a
 * tuple of the `nextSnapshot` and `actions` to execute from the
 * initial transition (no previous state).
 *
 * This is a pure function that does not execute `actions`.
 */
export function initialTransition<T extends AnyActorLogic>(
  logic: T,
  ...[input]: undefined extends InputFrom<T>
    ? [input?: InputFrom<T>]
    : [input: InputFrom<T>]
): [SnapshotFrom<T>, ExecutableAction[]] {
  const executableActions = [] as ExecutableAction[];

  const actorScope = createInertActorScope(logic);
  actorScope.actionExecutor = (action) => {
    executableActions.push(action);
  };

  const nextSnapshot = logic.getInitialSnapshot(actorScope, input);

  return [nextSnapshot, executableActions];
}
