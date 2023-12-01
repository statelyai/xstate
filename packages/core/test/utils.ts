import {
  AnyMachineSnapshot,
  AnyStateMachine,
  matchesState,
  StateNode,
  StateValue
} from '../src/index.ts';

const resolveSerializedStateValue = (
  machine: AnyStateMachine,
  serialized: string
) =>
  serialized[0] === '{'
    ? machine.resolveState({ value: JSON.parse(serialized), context: {} })
    : machine.resolveState({ value: serialized, context: {} });

export function testMultiTransition(
  machine: AnyStateMachine,
  fromState: string,
  eventTypes: string
): AnyMachineSnapshot {
  const computeNext = (
    state: AnyMachineSnapshot | string,
    eventType: string
  ) => {
    if (typeof state === 'string') {
      state = resolveSerializedStateValue(machine, state);
    }
    const nextState = machine.transition(
      state as any,
      { type: eventType },
      {} as any // TODO: figure out the simulation API
    );
    return nextState;
  };

  const [firstEventType, ...restEvents] = eventTypes.split(/,\s?/);

  const resultState = restEvents.reduce<AnyMachineSnapshot>(
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
          expect(resultState.value).toEqual(
            resolveSerializedStateValue(machine, fromState).value
          );
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
    state.entry.unshift(function __testEntryTracker() {
      logs.push(`enter: ${stateDescription}`);
    });
    state.exit.unshift(function __testExitTracker() {
      logs.push(`exit: ${stateDescription}`);
    });
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
