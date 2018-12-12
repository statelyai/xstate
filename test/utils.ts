import { StateNode, State } from '../src/index';
import { assert } from 'chai';
import { matchesState } from '../lib';

export function testMultiTransition<TExt>(
  machine: StateNode<TExt>,
  fromState: string,
  eventTypes: string
) {
  const resultState = eventTypes
    .split(/,\s?/)
    .reduce((state: State<TExt> | string, eventType) => {
      if (typeof state === 'string' && state[0] === '{') {
        state = JSON.parse(state);
      }
      const nextState = machine.transition(state, eventType);
      return nextState;
    }, fromState) as State<TExt>;

  return resultState;
}

export function testAll(machine: StateNode, expected: {}): void {
  Object.keys(expected).forEach(fromState => {
    Object.keys(expected[fromState]).forEach(eventTypes => {
      const toState = expected[fromState][eventTypes];

      it(`should go from ${fromState} to ${JSON.stringify(
        toState
      )} on ${eventTypes}`, () => {
        const resultState = testMultiTransition(machine, fromState, eventTypes);

        if (toState === undefined) {
          // undefined means that the state didn't transition
          assert.isEmpty(resultState.actions);
          assert.isFalse(resultState.changed);
        } else if (typeof toState === 'string') {
          assert.ok(
            matchesState(toState, resultState.value),
            `${JSON.stringify(resultState.value)} does not match ${toState}`
          );
        } else {
          assert.deepEqual(resultState.value, toState);
        }
      });
    });
  });
}
