import { Machine, StateValue } from '../../src/index';
import { testMultiTransition } from '../utils';

describe('Example 6.17', () => {
  const machine = Machine({
    initial: 'X',
    states: {
      X: {
        on: {
          1: 'Y',
          2: 'Y.A.C', // 6.18
          // 3: { Y: { A: 'C', B: 'F' } } // 6.19
          4: 'Y.A.hist'
        }
      },
      Y: {
        type: 'parallel',
        states: {
          A: {
            initial: 'D',
            states: { C: {}, D: {}, E: {}, hist: { history: true } }
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

  const expected: Record<string, Record<string, StateValue>> = {
    X: {
      1: { Y: { A: 'D', B: 'G' } },
      2: { Y: { A: 'C', B: 'G' } }, // 6.18
      // 3: { Y: { A: 'C', B: 'F' } }, //  6.19
      '2, back, 4': { Y: { A: 'C', B: 'G' } }
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

  Object.keys(expected).forEach((fromState) => {
    Object.keys(expected[fromState]).forEach((eventTypes) => {
      const toState = expected[fromState][eventTypes];

      it(`should go from ${fromState} to ${JSON.stringify(
        toState
      )} on ${eventTypes}`, () => {
        const resultState = testMultiTransition(machine, fromState, eventTypes);

        expect(resultState.value).toEqual(toState);
      });
    });
  });
});

describe('Jump to ID', () => {
  const machine = Machine({
    initial: 'X',
    states: {
      X: {
        id: 'X',
        on: {
          1: 'Y',
          2: 'Y.A.C', // 6.18
          // 3: { Y: { A: 'C', B: 'F' } } // 6.19
          4: 'Y.A.hist'
        }
      },
      Y: {
        type: 'parallel',
        states: {
          A: {
            initial: 'D',
            states: {
              C: {
                on: {
                  finish: '#X'
                }
              },
              D: {},
              E: {},
              hist: { history: true }
            }
          },
          B: {
            initial: 'G',
            states: { F: {}, G: {}, H: {} }
          }
        },
        on: {
          kill: '#X'
        }
      }
    }
  });

  const expected: Record<string, Record<string, string>> = {
    'Y.B.G': {
      kill: 'X'
    },
    '{"Y":{"A":"C","B":"H"}}': {
      finish: 'X'
    }
  };

  Object.keys(expected).forEach((fromState) => {
    Object.keys(expected[fromState]).forEach((eventTypes) => {
      const toState = expected[fromState][eventTypes];

      it(`should go from ${fromState} to ${JSON.stringify(
        toState
      )} on ${eventTypes}`, () => {
        const resultState = testMultiTransition(machine, fromState, eventTypes);

        expect(resultState.value).toEqual(toState);
      });
    });
  });
});
