import { toActionObject } from '../src/actions.ts';
import {
  AnyState,
  AnyStateMachine,
  matchesState,
  StateNode,
  StateValue
} from '../src/index.ts';

export function testMultiTransition(
  machine: AnyStateMachine,
  fromState: string,
  eventTypes: string
): AnyState {
  const computeNext = (state: AnyState | string, eventType: string) => {
    if (typeof state === 'string') {
      state =
        state[0] === '{'
          ? machine.resolveStateValue(JSON.parse(state))
          : machine.resolveStateValue(state);
    }
    const nextState = machine.transition(
      state,
      { type: eventType },
      undefined as any // TODO: figure out the simulation API
    );
    return nextState;
  };

  const [firstEventType, ...restEvents] = eventTypes.split(/,\s?/);

  const resultState = restEvents.reduce<AnyState>(
    computeNext,
    computeNext(fromState, firstEventType)
  );

  return resultState;
}

export function testAll(
  machine: AnyStateMachine,
  expected: Record<string, Record<string, StateValue | undefined>>
): void {
  Object.keys(expected).forEach((fromState) => {
    Object.keys(expected[fromState]).forEach((eventTypes) => {
      const toState = expected[fromState][eventTypes];

      it(`should go from ${fromState} to ${JSON.stringify(
        toState
      )} on ${eventTypes}`, () => {
        const resultState = testMultiTransition(machine, fromState, eventTypes);

        if (toState === undefined) {
          // undefined means that the state didn't transition
          expect(resultState.changed).toBe(false);
        } else if (typeof toState === 'string') {
          expect(matchesState(toState, resultState.value)).toBeTruthy();
        } else {
          expect(resultState.value).toEqual(toState);
        }
      });
    });
  });
}

const seen = new WeakSet<AnyStateMachine>();

export function trackEntries(machine: AnyStateMachine) {
  if (seen.has(machine)) {
    throw new Error(`This helper can't accept the same machine more than once`);
  }
  seen.add(machine);

  let logs: string[] = [];

  function addTrackingActions(
    state: StateNode<any, any>,
    stateDescription: string
  ) {
    state.entry.unshift(
      toActionObject(function __testEntryTracker() {
        logs.push(`enter: ${stateDescription}`);
      })
    );
    state.exit.unshift(
      toActionObject(function __testExitTracker() {
        logs.push(`exit: ${stateDescription}`);
      })
    );
  }

  function addTrackingActionsRecursively(state: StateNode<any, any>) {
    for (const child of Object.values(state.states)) {
      addTrackingActions(child, child.path.join('.'));
      addTrackingActionsRecursively(child);
    }
  }

  addTrackingActions(machine.root, `__root__`);
  addTrackingActionsRecursively(machine.root);

  return () => {
    const flushed = logs;
    logs = [];
    return flushed;
  };
}
