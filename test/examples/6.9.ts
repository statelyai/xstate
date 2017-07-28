import { assert } from 'chai';
import { Machine, Node, State } from '../../src/index';
import { testMultiTransition } from '../utils';

describe('Example 6.8', () => {
  const machine = new Machine({
    initial: 'A',
    states: {
      A: {
        on: {
          6: 'H'
        },
        initial: 'B',
        states: {
          B: {
            initial: 'E',
            on: {
              5: 'C'
            },
            states: {
              D: {},
              E: {
                on: { 3: 'D' }
              }
            }
          },
          C: {
            initial: 'G',
            on: {
              4: 'B.E'
            },
            states: {
              F: {},
              G: {
                on: {
                  2: 'F'
                }
              }
            }
          }
        }
      },
      H: {
        on: {
          1: 'A.$history'
        }
      }
    }
  });

  const expected = {
    A: {
      3: 'A.B.D',
      5: 'A.C.G',
      6: 'H',
      FAKE: 'A.B.E'
    },
    'A.B': {
      3: 'A.B.D',
      5: 'A.C.G',
      6: 'H',
      FAKE: 'A.B.E',

      // history
      '5, 6, 1': 'A.C.G',
      '3, 6, 1': 'A.B.E' // not A.B.D because not deep history
    },
    'A.C': {
      2: 'A.C.F',
      4: 'A.B.E',
      6: 'H',
      FAKE: 'A.C.G',
      '6, 1': 'A.C.G',
      '4, 6, 1': 'A.B.E'
    },
    'A.B.D': {
      5: 'A.C.G',
      6: 'H',
      FAKE: 'A.B.D'
    },
    'A.B.E': {
      3: 'A.B.D',
      5: 'A.C.G',
      6: 'H',
      FAKE: 'A.B.E'
    },
    'A.C.F': {
      4: 'A.B.E',
      6: 'H',
      FAKE: 'A.C.F'
    },
    'A.C.G': {
      2: 'A.C.F',
      4: 'A.B.E',
      6: 'H',
      FAKE: 'A.C.G'
    },
    H: {
      1: 'A.B.E',
      FAKE: 'H'
    }
  };

  Object.keys(expected).forEach(fromState => {
    Object.keys(expected[fromState]).forEach(actionTypes => {
      const toState = expected[fromState][actionTypes];

      it(`should go from ${fromState} to ${toState} on ${actionTypes}`, () => {
        const resultState = testMultiTransition(
          machine,
          fromState,
          actionTypes
        );

        assert.equal(resultState.value, toState);
      });
    });
  });
});
