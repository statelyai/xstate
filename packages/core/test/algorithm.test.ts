import { Machine } from '../src';
import { getConfiguration } from '../src/stateUtils';

const testMachine = Machine({
  id: 'a',
  initial: 'b1',
  states: {
    b1: {
      id: 'b1',
      type: 'parallel',
      states: {
        c1: {
          id: 'c1',
          initial: 'd1',
          states: {
            d1: { id: 'd1' },
            d2: {
              id: 'd2',
              initial: 'e1',
              states: {
                e1: { id: 'e1' },
                e2: { id: 'e2' }
              }
            }
          }
        },
        c2: { id: 'c2' },
        c3: {
          id: 'c3',
          initial: 'd3',
          states: {
            d3: { id: 'd3' },
            d4: {
              id: 'd4',
              initial: 'e3',
              states: {
                e3: { id: 'e3' },
                e4: { id: 'e4' }
              }
            }
          }
        }
      }
    },
    b2: {
      id: 'b2',
      initial: 'c4',
      states: {
        c4: { id: 'c4' }
      }
    },
    b3: {
      id: 'b3',
      initial: 'c5',
      states: {
        c5: { id: 'c5' },
        c6: {
          id: 'c6',
          type: 'parallel',
          states: {
            d5: { id: 'd5' },
            d6: { id: 'd6' },
            d7: { id: 'd7' }
          }
        }
      }
    }
  }
});

describe('algorithm', () => {
  it('getConfiguration', () => {
    const prevNodes = testMachine.getStateNodes({
      b1: {
        c1: 'd1',
        c2: {},
        c3: 'd3'
      }
    });
    const nodes = ['c1', 'd4'].map((id) => testMachine.getStateNodeById(id));

    const c = getConfiguration(prevNodes, nodes);

    expect([...c].map((sn) => sn.id).sort()).toEqual([
      'a',
      'b1',
      'c1',
      'c2',
      'c3',
      'd1',
      'd4',
      'e3'
    ]);
  });
});
