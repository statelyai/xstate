import { createMachine } from '../../src/index';
import { testAll } from '../utils';

describe('Example 6.8', () => {
  const machine = createMachine({
    initial: 'A',
    states: {
      A: {
        on: {
          6: 'F'
        },
        initial: 'B',
        states: {
          B: {
            on: { 1: 'C' }
          },
          C: {
            on: { 2: 'E' }
          },
          D: {
            on: { 3: 'B' }
          },
          E: {
            on: { 4: 'B', 5: 'D' }
          },
          hist: { history: true }
        }
      },
      F: {
        on: {
          5: 'A.hist'
        }
      }
    }
  });

  const expected = {
    A: {
      1: 'A.C',
      6: 'F'
    },
    '{"A":"B"}': {
      1: 'A.C',
      6: 'F',
      FAKE: undefined
    },
    '{"A":"C"}': {
      2: 'A.E',
      6: 'F',
      FAKE: undefined
    },
    '{"A":"D"}': {
      3: 'A.B',
      6: 'F',
      FAKE: undefined
    },
    '{"A":"E"}': {
      4: 'A.B',
      5: 'A.D',
      6: 'F',
      FAKE: undefined
    },
    F: {
      5: 'A.B'
    }
  };

  testAll(machine, expected);

  it('should respect the history mechanism', () => {
    const stateC = machine.transition({ A: 'B' }, { type: '1' });
    const stateF = machine.transition(stateC, { type: '6' });
    const stateActual = machine.transition(stateF, { type: '5' });

    expect(stateActual.value).toEqual({ A: 'C' });
  });
});
