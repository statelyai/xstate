import { assert } from 'chai';
import { Machine, State } from '../../src/index';
import { testMultiTransition } from '../utils';

describe('Example 6.16', () => {
  const machine = Machine({
    parallel: true,
    states: {
      A: {
        initial: 'D',
        states: {
          C: { on: { 2: 'D' } },
          D: { on: { 1: 'C' } }
        }
      },
      B: {
        initial: 'F',
        states: {
          E: { on: { 5: 'G' } },
          F: { on: { 1: 'E' } },
          G: { on: { 3: 'F' } }
        }
      }
    }
  });

  const expected = {
    '{"A":"D", "B":"F"}': {
      1: { A: 'C', B: 'E' },
      2: { A: 'D', B: 'F' },
      '1, 5, 3': { A: 'C', B: 'F' }
    },
    '{"A":"C", "B":"E"}': {
      1: { A: 'C', B: 'E' },
      2: { A: 'D', B: 'E' },
      5: { A: 'C', B: 'G' }
    },
    '{"A":"C", "B":"G"}': {
      1: { A: 'C', B: 'G' },
      2: { A: 'D', B: 'G' },
      3: { A: 'C', B: 'F' }
    }
  };

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

        assert.deepEqual(resultState.value, toState);
      });
    });
  });
});
