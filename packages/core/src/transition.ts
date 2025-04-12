import { createInertActorScope } from './getNextSnapshot';
import {
  AnyActorLogic,
  EventFromLogic,
  InputFrom,
  SnapshotFrom,
  ExecutableActionsFrom
} from './types';

/**
 * Given actor `logic`, a `snapshot`, and an `event`, returns a tuple of the
 * `nextSnapshot` and `actions` to execute.
 *
 * This is a pure function that does not execute `actions`.
 */
export function transition<T extends AnyActorLogic>(
  logic: T,
  snapshot: SnapshotFrom<T>,
  event: EventFromLogic<T>
): [nextSnapshot: SnapshotFrom<T>, actions: ExecutableActionsFrom<T>[]] {
  const executableActions = [] as ExecutableActionsFrom<T>[];

  const actorScope = createInertActorScope(logic);
  actorScope.actionExecutor = (action) => {
    executableActions.push(action as ExecutableActionsFrom<T>);
  };

  const nextSnapshot = logic.transition(snapshot, event, actorScope);

  return [nextSnapshot, executableActions];
}

/**
 * Given actor `logic` and optional `input`, returns a tuple of the
 * `nextSnapshot` and `actions` to execute from the initial transition (no
 * previous state).
 *
 * This is a pure function that does not execute `actions`.
 */
export function initialTransition<T extends AnyActorLogic>(
  logic: T,
  ...[input]: undefined extends InputFrom<T>
    ? [input?: InputFrom<T>]
    : [input: InputFrom<T>]
): [SnapshotFrom<T>, ExecutableActionsFrom<T>[]] {
  const executableActions = [] as ExecutableActionsFrom<T>[];

  const actorScope = createInertActorScope(logic);
  actorScope.actionExecutor = (action) => {
    executableActions.push(action as ExecutableActionsFrom<T>);
  };

  const nextSnapshot = logic.getInitialSnapshot(
    actorScope,
    input
  ) as SnapshotFrom<T>;

  return [nextSnapshot, executableActions];
}
