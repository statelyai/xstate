import {
  AnyMachineSnapshot,
  AnyStateMachine,
  getNextSnapshot,
  matchesState,
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
    const nextState = getNextSnapshot(machine, state, {
      type: eventType
    });
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

type StateNodeLike = {
  states: Record<string, StateNodeLike>;
  path?: string[];
  entry?: (...args: any[]) => void;
  exit?: (...args: any[]) => void;
};
const seen = new WeakSet<StateNodeLike>();

export function trackEntries(machine: StateNodeLike & { root: StateNodeLike }) {
  if (seen.has(machine)) {
    throw new Error(`This helper can't accept the same machine more than once`);
  }
  seen.add(machine);

  let logs: string[] = [];

  function addTrackingActions(state: StateNodeLike, stateDescription: string) {
    const originalEntry2 = state.entry;
    const originalExit2 = state.exit;
    state.entry = (_, enq) => {
      enq(() => logs.push(`enter: ${stateDescription}`));
      return originalEntry2?.(_, enq);
    };
    state.exit = (_, enq) => {
      enq(() => logs.push(`exit: ${stateDescription}`));
      return originalExit2?.(_, enq);
    };
  }

  function addTrackingActionsRecursively(state: StateNodeLike) {
    for (const child of Object.values(state.states)) {
      addTrackingActions(child, child.path!.join('.'));
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
