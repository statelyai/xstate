import { createInitEvent } from './eventUtils';
import { createInertActorScope } from './getNextSnapshot';
import {
  getProperAncestors,
  initialMicrostep,
  isAtomicStateNode,
  macrostep
} from './stateUtils';
import {
  AnyActorLogic,
  AnyEventObject,
  AnyStateMachine,
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
 * Given a state `machine`, a `snapshot`, and an `event`, returns an array of
 * microsteps, where each microstep is a tuple of `[snapshot, actions]`.
 *
 * This is a pure function that does not execute `actions`.
 */
export function getMicrosteps<T extends AnyStateMachine>(
  machine: T,
  snapshot: SnapshotFrom<T>,
  event: EventFromLogic<T>
): Array<[SnapshotFrom<T>, ExecutableActionsFrom<T>[]]> {
  const actorScope = createInertActorScope(machine);

  const { microsteps } = macrostep(snapshot, event, actorScope, []);

  return microsteps as Array<[SnapshotFrom<T>, ExecutableActionsFrom<T>[]]>;
}

/**
 * Given a state `machine` and optional `input`, returns an array of microsteps
 * from the initial transition, where each microstep is a tuple of `[snapshot,
 * actions]`.
 *
 * This is a pure function that does not execute `actions`.
 */
export function getInitialMicrosteps<T extends AnyStateMachine>(
  machine: T,
  ...[input]: undefined extends InputFrom<T>
    ? [input?: InputFrom<T>]
    : [input: InputFrom<T>]
): Array<[SnapshotFrom<T>, ExecutableActionsFrom<T>[]]> {
  const actorScope = createInertActorScope(machine);
  const initEvent = createInitEvent(input);
  const internalQueue: AnyEventObject[] = [];

  const preInitialSnapshot = machine._getPreInitialState(
    actorScope,
    initEvent,
    internalQueue
  );

  const first = initialMicrostep(
    machine.root,
    preInitialSnapshot,
    actorScope,
    initEvent,
    internalQueue
  );

  const { microsteps } = macrostep(
    first[0],
    initEvent,
    actorScope,
    internalQueue
  );

  return [first, ...microsteps] as Array<
    [SnapshotFrom<T>, ExecutableActionsFrom<T>[]]
  >;
}

/**
 * Gets all potential next transitions from the current state.
 *
 * Returns all transitions that are available from the current state, including:
 *
 * - All transitions from atomic states (leaf states in the current state
 *   configuration)
 * - All transitions from ancestor states (parent states that may handle events)
 * - All guarded transitions (regardless of whether their guards would pass)
 * - Always (eventless) transitions
 * - After (delayed) transitions
 *
 * The order of transitions is deterministic:
 *
 * 1. Atomic states are processed in document order
 * 2. For each atomic state, transitions are collected from the state itself first,
 *    then its ancestors
 * 3. Within each state node, transitions are in the order they appear in the state
 *    definition
 *
 * @param state - The current machine snapshot
 * @returns Array of transition definitions from the current state, in
 *   deterministic order
 */
export function getNextTransitions(
  state: AnyMachineSnapshot
): AnyTransitionDefinition[] {
  const potentialTransitions: AnyTransitionDefinition[] = [];
  const atomicStates = state._nodes.filter(isAtomicStateNode);
  const visited = new Set();

  // Collect all transitions from atomic states and their ancestors
  // Process atomic states in document order (as they appear in state._nodes)
  for (const stateNode of atomicStates) {
    // For each atomic state, process the state itself first, then its ancestors
    // This ensures child state transitions come before parent state transitions
    for (const s of [stateNode].concat(
      getProperAncestors(stateNode, undefined)
    )) {
      if (visited.has(s.id)) {
        continue;
      }
      visited.add(s.id);

      // Get all transitions for each event type
      // Include ALL transitions, even if the same event type appears in multiple state nodes
      // This is important for guarded transitions - all are "potential" regardless of guard evaluation
      for (const [, transitions] of s.transitions) {
        potentialTransitions.push(...transitions);
      }

      // Also include always (eventless) transitions
      if (s.always) {
        potentialTransitions.push(...s.always);
      }
    }
  }

  return potentialTransitions;
}
