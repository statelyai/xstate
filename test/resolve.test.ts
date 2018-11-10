import { Machine } from '../src/index';
import { assert } from 'chai';

// from parallel/test3.scxml
const flatParallelMachine = Machine({
  id: 'fp',
  initial: 'p1',
  states: {
    p1: {
      type: 'parallel',
      states: {
        s1: {
          initial: 'p2',
          states: {
            p2: {
              type: 'parallel',
              states: {
                s3: {
                  initial: 's3.1',
                  states: {
                    's3.1': {},
                    's3.2': {}
                  }
                },
                s4: {}
              }
            },
            p3: {
              type: 'parallel',
              states: {
                s5: {},
                s6: {}
              }
            }
          }
        },
        s2: {
          initial: 'p4',
          states: {
            p4: {
              type: 'parallel',
              states: {
                s7: {},
                s8: {}
              }
            },
            p5: {
              type: 'parallel',
              states: {
                s9: {},
                s10: {}
              }
            }
          }
        }
      }
    }
  }
});

describe('machine.resolve()', () => {
  it('should resolve parallel states with flat child states', () => {
    const unresolvedStateValue = { p1: { s1: { p2: 's4' }, s2: { p4: 's8' } } };

    const resolvedStateValue = flatParallelMachine.resolve(
      unresolvedStateValue
    );
    assert.deepEqual(resolvedStateValue, {
      p1: { s1: { p2: { s3: 's3.1', s4: {} } }, s2: { p4: { s7: {}, s8: {} } } }
    });
  });
});
