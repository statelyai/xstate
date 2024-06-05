import { createInertActorScope } from './getNextSnapshot';
import { ExecutableAction } from './stateUtils';
import { AnyActorLogic, EventFrom, SnapshotFrom } from './types';

export function transition<T extends AnyActorLogic>(
  logic: T,
  snapshot: SnapshotFrom<T>,
  event: EventFrom<T>
): [SnapshotFrom<T>, ExecutableAction[]] {
  const executableActions = [] as ExecutableAction[];

  const actorScope = createInertActorScope(logic);
  actorScope.actionExecutor = (action) => {
    executableActions.push(action);
  };

  const nextSnapshot = logic.transition(snapshot, event, actorScope);

  return [nextSnapshot, executableActions];
}
