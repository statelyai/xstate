import { StateNode, State } from '../src/index';
import { assert } from 'chai';

export function testMultiTransition(
  machine: StateNode,
  fromState: string,
  eventTypes: string
) {
  const resultState = eventTypes
    .split(/,\s?/)
    .reduce((state: State | string, eventType) => {
      if (typeof state === 'string' && state[0] === '{') {
        state = JSON.parse(state);
      }
      const nextState = machine.transition(state, eventType);
      return nextState;
    }, fromState);

  return resultState as State;
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
          assert.isUndefined(resultState);
        } else if (typeof toState === 'string') {
          assert.equal(resultState.toString(), toState);
        } else {
          assert.deepEqual(resultState.value, toState);
        }
      });
    });
  });
}
