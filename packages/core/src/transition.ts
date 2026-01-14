import { createInitEvent } from './eventUtils';
import { createInertActorScope } from './getNextSnapshot';
import {
  getInitialStateNodes,
  macrostepWithActions,
  microstep
} from './stateUtils';
import {
  AnyActorLogic,
  AnyEventObject,
  AnyStateMachine,
  EventFromLogic,
  ExecutableActionObject,
  ExecutableActionsFrom,
  InputFrom,
  SnapshotFrom
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

  const { microsteps } = macrostepWithActions(snapshot, event, actorScope, []);

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

  // Get pre-initial state (mimics StateMachine.getPreInitialState)
  const preInitialSnapshot = (machine as any).getPreInitialState(
    actorScope,
    initEvent,
    internalQueue
  );

  // Capture actions for the initial microstep
  let currentActions: ExecutableActionObject[] = [];
  actorScope.actionExecutor = (action) => {
    currentActions.push(action);
  };

  // Run the initial microstep (entering initial states)
  const nextState = microstep(
    [
      {
        target: [...getInitialStateNodes(machine.root)],
        source: machine.root,
        reenter: true,
        actions: [],
        eventType: null as any,
        toJSON: null as any
      }
    ],
    preInitialSnapshot,
    actorScope,
    initEvent,
    true, // isInitial
    internalQueue
  );

  const initialMicrostep: [SnapshotFrom<T>, ExecutableActionsFrom<T>[]] = [
    nextState as SnapshotFrom<T>,
    currentActions as ExecutableActionsFrom<T>[]
  ];

  // Run macrostep for any eventless transitions or internal queue events
  const { microsteps } = macrostepWithActions(
    nextState,
    initEvent,
    actorScope,
    internalQueue
  );

  return [
    initialMicrostep,
    ...(microsteps as Array<[SnapshotFrom<T>, ExecutableActionsFrom<T>[]]>)
  ];
}
