import { createMachine, createActor } from '../../src/index.ts';
import { testAll } from '../utils.ts';

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
    const actorRef = createActor(machine).start();

    actorRef.send({ type: '1' });
    actorRef.send({ type: '6' });
    actorRef.send({ type: '5' });

    expect(actorRef.getSnapshot().value).toEqual({ A: 'C' });
  });
});
