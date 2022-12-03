import {
  AnyState,
  AnyStateMachine,
  matchesState,
  StateValue
} from '../src/index';

export function testMultiTransition(
  machine: AnyStateMachine,
  fromState: string,
  eventTypes: string
): AnyState {
  const computeNext = (state: AnyState | string, eventType: string) => {
    if (typeof state === 'string' && state[0] === '{') {
      state = JSON.parse(state);
    }
    const nextState = machine.transition(state, eventType);
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
          expect(resultState.actions).toEqual([]);
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
