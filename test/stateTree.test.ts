import { StateTree } from '../src/StateTree';
import { Machine } from '../src';
import { assert } from 'chai';

const testMachine = Machine({
  id: 'test',
  initial: 'a',
  states: {
    a: {
      initial: 'one',
      states: {
        one: {},
        two: {
          type: 'final'
        }
      }
    },
    b: {
      type: 'parallel',
      states: {
        one: {
          initial: 'foo',
          states: { foo: {}, bar: { type: 'final' } }
        },
        two: {
          initial: 'foo',
          states: {
            foo: {
              initial: 'x',
              states: {
                x: {}
              }
            },
            bar: { type: 'final' }
          }
        }
      }
    },
    c: {
      initial: 'one',
      states: {
        one: {
          initial: 'aa',
          states: {
            aa: {
              initial: 'foo',
              states: { foo: {} }
            },
            bb: {
              initial: 'foo',
              states: { foo: {} }
            },
            cc: {}
          }
        },
        two: {
          initial: 'aa',
          states: {
            aa: {},
            bb: {},
            cc: {}
          }
        },
        three: {
          type: 'parallel',
          states: {
            aa: {
              initial: 'aaa',
              states: { aaa: {}, bbb: {} }
            },
            bb: {
              initial: 'aaa',
              states: { aaa: {}, bbb: {} }
            }
          }
        }
      }
    }
  }
});

describe('StateTree', () => {
  describe('.resolved', () => {
    it('represents the full value (compound)', () => {
      const st = new StateTree(testMachine, 'a').resolved;

      assert.deepEqual(st.stateValue, { a: 'one' });
    });

    it('represents the full value (parallel)', () => {
      const st = new StateTree(testMachine, 'b').resolved;

      assert.deepEqual(st.stateValue, {
        b: {
          one: 'foo',
          two: { foo: 'x' }
        }
      });
    });
  });

  xit('represents the full value (parallel deep)', () => {
    const st = new StateTree(testMachine, { b: 'two' });

    assert.deepEqual(st.stateValue, {
      b: {
        one: 'foo',
        two: { foo: 'x' }
      }
    });
  });

  it('getEntryExitStates() should show correct entry/exit state nodes', () => {
    const st_A = new StateTree(testMachine, 'c').resolved; // { c: { one: 'aa' }}
    const st_B = new StateTree(testMachine, { c: { one: 'bb' } }).resolved;

    const res = st_B.getEntryExitStates(st_A);
    assert.deepEqual([...res.exit].map(n => n.id), [
      'test.c.one.aa.foo',
      'test.c.one.aa'
    ]);
    assert.deepEqual([...res.entry].map(n => n.id), [
      'test.c.one.bb',
      'test.c.one.bb.foo'
    ]);
  });
});
