import { StateNode, State } from '../src/index';
import { assert } from 'chai';

export function testMultiTransition(
  machine: StateNode,
  fromState: string,
  actionTypes: string
) {
  const resultState = actionTypes
    .split(/,\s?/)
    .reduce((state: State | string, actionType) => {
      if (typeof state === 'string' && state[0] === '{') {
        state = JSON.parse(state);
      }
      const nextState = machine.transition(state, actionType);
      return nextState;
    }, fromState);

  return resultState as State;
}

export function testAll(machine: StateNode, expected: {}): void {
  Object.keys(expected).forEach(fromState => {
    Object.keys(expected[fromState]).forEach(actionTypes => {
      const toState = expected[fromState][actionTypes];

      it(`should go from ${fromState} to ${JSON.stringify(
        toState
      )} on ${actionTypes}`, () => {
        const resultState = testMultiTransition(
          machine,
          fromState,
          actionTypes
        );

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
