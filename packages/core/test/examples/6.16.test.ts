import { Machine, StateValue } from '../../src/index';
import { testAll } from '../utils';

describe('Example 6.16', () => {
  const machine = Machine({
    type: 'parallel',
    states: {
      A: {
        initial: 'D',
        states: {
          C: {
            on: {
              2: {
                target: 'D',
                in: 'B.E'
              }
            }
          },
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

  const expected: Record<string, Record<string, StateValue | undefined>> = {
    '{"A":"D", "B":"F"}': {
      1: { A: 'C', B: 'E' },
      2: undefined,
      '1, 5, 3': { A: 'C', B: 'F' }
    },
    '{"A":"C", "B":"E"}': {
      1: undefined,
      2: { A: 'D', B: 'E' },
      5: { A: 'C', B: 'G' }
    },
    '{"A":"C", "B":"G"}': {
      1: undefined,
      2: undefined,
      3: { A: 'C', B: 'F' }
    }
  };

  testAll(machine, expected);
});
