import { createInertActorScope } from './getNextSnapshot';
import { getProperAncestors, isAtomicStateNode } from './stateUtils';
import {
  AnyActorLogic,
  EventFromLogic,
  InputFrom,
  SnapshotFrom,
  ExecutableActionsFrom,
  AnyTransitionDefinition,
  AnyMachineSnapshot
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

/**
 * Gets all potential next transitions from the current state.
 *
 * @param state - The current machine snapshot
 * @returns Array of transition definitions from the current state
 */
export function getPotentialTransitions(
  state: AnyMachineSnapshot
): AnyTransitionDefinition[] {
  const potentialTransitions: AnyTransitionDefinition[] = [];
  const atomicStates = state._nodes.filter(isAtomicStateNode);
  const processedEventTypes = new Set<string>();

  // Collect all transitions from atomic states and their ancestors
  for (const stateNode of atomicStates) {
    for (const s of [stateNode].concat(
      getProperAncestors(stateNode, undefined)
    )) {
      // Get all transitions for each event type
      for (const [eventType, transitions] of s.transitions) {
        if (processedEventTypes.has(eventType)) {
          continue;
        }

        potentialTransitions.push(...transitions);
        processedEventTypes.add(eventType);
      }

      // Also include always (eventless) transitions
      if (s.always) {
        potentialTransitions.push(...s.always);
      }
    }
  }

  return potentialTransitions;
}
