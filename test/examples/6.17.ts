import { assert } from 'chai';
import { Machine, Node, State } from '../../src/index';
import { testMultiTransition } from '../utils';

describe('Example 6.17', () => {
  const machine = new Machine({
    initial: 'X',
    states: {
      X: {
        on: {
          1: 'Y',
          2: 'Y.A.C', // 6.18
          // 3: { Y: { A: 'C', B: 'F' } } // 6.19
          4: 'Y.A.$history'
        }
      },
      Y: {
        parallel: true,
        states: {
          A: {
            initial: 'D',
            states: { C: {}, D: {}, E: {} }
          },
          B: {
            initial: 'G',
            states: { F: {}, G: {}, H: {} }
          }
        },
        on: {
          back: 'X'
        }
      }
    }
  });

  const expected = {
    X: {
      1: { Y: { A: 'D', B: 'G' } },
      2: { Y: { A: 'C', B: 'G' } } // 6.18
      // 3: { Y: { A: 'C', B: 'F' } }, //  6.19
      // '2, back, 4': { Y: { A: 'C', B: 'G' } }
    },
    '{"Y":{"A":"C","B":"G"}}': {
      back: 'X'
    },
    'Y.A.C': {
      back: 'X'
    },
    'Y.B.G': {
      back: 'X'
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
